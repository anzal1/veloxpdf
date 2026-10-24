import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER = fileURLToPath(new URL('../bin/veloxpdf-mcp.mjs', import.meta.url));

// Starts the MCP server and talks to it with newline-delimited JSON-RPC on stdin and stdout.
function startServer({ cwd, env = {} }) {
  const child = spawn(process.execPath, [SERVER], {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  child.stderr.resume();
  let buf = '';
  const lines = [];
  const waiters = [];
  child.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      if (!line.trim()) continue;
      lines.push(line);
      const w = waiters.shift();
      if (w) w(line);
    }
  });
  const nextLine = (ms = 10000) =>
    new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout waiting for a reply')), ms);
      waiters.push((l) => {
        clearTimeout(t);
        resolve(l);
      });
    });
  return {
    lines,
    async call(msg) {
      const p = nextLine();
      child.stdin.write((typeof msg === 'string' ? msg : JSON.stringify(msg)) + '\n');
      return JSON.parse(await p);
    },
    notify(msg) {
      child.stdin.write(JSON.stringify(msg) + '\n');
    },
    async close() {
      const exited = new Promise((r) => child.on('exit', r));
      child.stdin.end();
      await exited;
    },
  };
}

const HTML =
  '<html><body class="p-6"><h1 class="text-2xl font-bold">Invoice {{no}}</h1><p>Total {{total}}</p></body></html>';
const DATA = { no: 'INV-7', total: '99.00' };

describe('veloxpdf-mcp server', () => {
  let work;
  let outside;
  let srv;
  let id = 0;
  const tool = (name, args) =>
    srv.call({ jsonrpc: '2.0', id: ++id, method: 'tools/call', params: { name, arguments: args } });

  before(() => {
    work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'veloxpdf-mcp-')));
    outside = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'veloxpdf-mcp-outside-')));
    fs.symlinkSync(outside, path.join(work, 'escape-link'));
    srv = startServer({ cwd: work });
  });

  after(async () => {
    if (srv) await srv.close();
    fs.rmSync(work, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  });

  it('initialize returns 2025-06-18, tools capability and serverInfo', async () => {
    const r = await srv.call({
      jsonrpc: '2.0',
      id: ++id,
      method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } },
    });
    assert.equal(r.jsonrpc, '2.0');
    assert.equal(r.id, id);
    assert.equal(r.result.protocolVersion, '2025-06-18');
    assert.ok(r.result.capabilities.tools);
    assert.equal(r.result.serverInfo.name, 'veloxpdf');
    assert.match(r.result.serverInfo.version, /^\d+\.\d+\.\d+/);
  });

  it('notifications/initialized gets no reply and string ids are kept', async () => {
    srv.notify({ jsonrpc: '2.0', method: 'notifications/initialized' });
    const r = await srv.call({ jsonrpc: '2.0', id: 'ping-1', method: 'ping' });
    assert.equal(r.id, 'ping-1');
    assert.deepEqual(r.result, {});
  });

  it('tools/list lists the four tools with object input schemas', async () => {
    const r = await srv.call({ jsonrpc: '2.0', id: ++id, method: 'tools/list' });
    assert.deepEqual(r.result.tools.map((t) => t.name).sort(), [
      'extract_pdf_data',
      'render_pdf',
      'sign_pdf',
      'verify_pdf',
    ]);
    for (const t of r.result.tools) {
      assert.equal(t.inputSchema.type, 'object');
      assert.ok(t.description.length > 20);
      assert.ok(Array.isArray(t.inputSchema.required));
    }
  });

  it('render_pdf without output_path returns a base64 PDF', async () => {
    const r = await tool('render_pdf', { html: HTML, data: DATA });
    assert.equal(r.result.isError, undefined);
    const sc = r.result.structuredContent;
    assert.equal(Buffer.from(sc.base64, 'base64').subarray(0, 5).toString(), '%PDF-');
    assert.equal(sc.pageCount, 1);
    assert.equal(sc.signed, false);
    assert.equal(r.result.content[0].type, 'text');
  });

  it('render_pdf writes a signed file inside the root', async () => {
    const r = await tool('render_pdf', {
      html: HTML,
      data: DATA,
      options: { format: 'Letter', sign: { signerName: 'MCP Test', reason: 'test' }, footerText: 'Page {{page}} of {{pages}}' },
      output_path: 'out/invoice.pdf',
    });
    assert.equal(r.result.isError, undefined);
    assert.ok(fs.existsSync(path.join(work, 'out/invoice.pdf')));
    assert.equal(r.result.structuredContent.signed, true);
    assert.equal(r.result.structuredContent.base64, undefined);
  });

  it('verify_pdf reports a valid signature and the signer', async () => {
    const s = (await tool('verify_pdf', { path: 'out/invoice.pdf' })).result.structuredContent;
    assert.equal(s.valid, true);
    assert.equal(s.tamperDetected, false);
    assert.equal(s.signerName, 'MCP Test');
    assert.equal(s.byteRange.length, 4);
  });

  it('extract_pdf_data returns the embedded JSON', async () => {
    const s = (await tool('extract_pdf_data', { path: 'out/invoice.pdf' })).result.structuredContent;
    assert.equal(s.found, true);
    assert.deepEqual(s.data, DATA);
  });

  // The PDF/A font loader in src/pdf-writer.mjs calls process.getBuiltinModule, which Node 18 does not have.
  const noGetBuiltin = typeof process.getBuiltinModule !== 'function' && 'PDF/A font loading needs process.getBuiltinModule (Node 20.16+, 22.3+)';
  it('render_pdf with options.pdfa writes a PDF/A file', { skip: noGetBuiltin }, async () => {
    const r = await tool('render_pdf', { html: HTML, data: DATA, options: { pdfa: true }, output_path: 'pdfa.pdf' });
    assert.equal(r.result.isError, undefined);
    assert.ok(fs.readFileSync(path.join(work, 'pdfa.pdf')).includes(Buffer.from('pdfaid:part')));
  });

  it('verify_pdf on an unsigned PDF is a result, not a tool error', async () => {
    await tool('render_pdf', { html: HTML, data: DATA, output_path: 'plain.pdf' });
    const r = await tool('verify_pdf', { path: 'plain.pdf' });
    assert.equal(r.result.isError, undefined);
    assert.equal(r.result.structuredContent.valid, false);
    assert.ok(r.result.structuredContent.error);
  });

  it('sign_pdf writes a signed copy that verifies and leaves the input alone', async () => {
    const r = await tool('sign_pdf', {
      input_path: 'plain.pdf',
      output_path: 'plain-signed.pdf',
      signer_name: 'Alice Example',
      reason: 'approval',
      location: 'Berlin',
    });
    assert.equal(r.result.isError, undefined);
    assert.equal(r.result.structuredContent.valid, true);
    assert.equal(r.result.structuredContent.signerName, 'Alice Example');
    assert.ok(fs.statSync(path.join(work, 'plain-signed.pdf')).size > fs.statSync(path.join(work, 'plain.pdf')).size);
    assert.equal(fs.readFileSync(path.join(work, 'plain.pdf')).includes(Buffer.from('/ByteRange')), false);
  });

  it('verify_pdf detects a one-bit change', async () => {
    const t = fs.readFileSync(path.join(work, 'plain-signed.pdf'));
    t[60] ^= 0x01;
    fs.writeFileSync(path.join(work, 'tampered.pdf'), t);
    const s = (await tool('verify_pdf', { path: 'tampered.pdf' })).result.structuredContent;
    assert.equal(s.valid, false);
    assert.equal(s.tamperDetected, true);
  });

  it('refuses an absolute output path outside the root', async () => {
    const target = path.join(outside, 'abs.pdf');
    const r = await tool('render_pdf', { html: '<p>x</p>', output_path: target });
    assert.equal(r.result.isError, true);
    assert.match(r.result.content[0].text, /outside the allowed folder/);
    assert.ok(!fs.existsSync(target));
  });

  it('refuses ../ traversal', async () => {
    const r = await tool('render_pdf', { html: '<p>x</p>', output_path: '../escape.pdf' });
    assert.equal(r.result.isError, true);
    assert.ok(!fs.existsSync(path.join(path.dirname(work), 'escape.pdf')));
  });

  it('refuses a symlink that points outside the root', async () => {
    const r = await tool('render_pdf', { html: '<p>x</p>', output_path: 'escape-link/viaSymlink.pdf' });
    assert.equal(r.result.isError, true);
    assert.ok(!fs.existsSync(path.join(outside, 'viaSymlink.pdf')));
  });

  it('refuses a non-.pdf output path', async () => {
    const r = await tool('render_pdf', { html: '<p>x</p>', output_path: 'notes.txt' });
    assert.equal(r.result.isError, true);
    assert.match(r.result.content[0].text, /\.pdf/);
  });

  it('refuses to read a file outside the root', async () => {
    const secret = path.join(outside, 'secret.pdf');
    fs.writeFileSync(secret, '%PDF-1.7\n');
    const r = await tool('verify_pdf', { path: secret });
    assert.equal(r.result.isError, true);
  });

  it('refuses a file without a %PDF- header', async () => {
    fs.writeFileSync(path.join(work, 'fake.pdf'), 'not a pdf');
    const r = await tool('verify_pdf', { path: 'fake.pdf' });
    assert.equal(r.result.isError, true);
    assert.match(r.result.content[0].text, /Not a PDF/);
  });

  it('a missing file is a tool error', async () => {
    const r = await tool('verify_pdf', { path: 'missing.pdf' });
    assert.equal(r.result.isError, true);
    assert.match(r.result.content[0].text, /not found/i);
  });

  it('a missing required argument is a tool error naming the argument', async () => {
    const r = await tool('render_pdf', {});
    assert.equal(r.result.isError, true);
    assert.match(r.result.content[0].text, /html/);
  });

  it('a bad option value is a tool error', async () => {
    const r = await tool('render_pdf', { html: '<p>x</p>', options: { format: 'A0' } });
    assert.equal(r.result.isError, true);
  });

  it('an unknown tool gives JSON-RPC error -32602', async () => {
    const r = await tool('no_such_tool', {});
    assert.equal(r.error.code, -32602);
  });

  it('an unknown method gives -32601', async () => {
    const r = await srv.call({ jsonrpc: '2.0', id: ++id, method: 'resources/list' });
    assert.equal(r.error.code, -32601);
    assert.equal(r.id, id);
  });

  it('malformed JSON gives -32700 with a null id', async () => {
    const r = await srv.call('{ not json');
    assert.equal(r.error.code, -32700);
    assert.equal(r.id, null);
  });

  it('a message without the jsonrpc field gives -32600', async () => {
    const r = await srv.call({ id: ++id, method: 'ping' });
    assert.equal(r.error.code, -32600);
  });

  it('an unsupported protocol version is answered with the latest supported one', async () => {
    const r = await srv.call({ jsonrpc: '2.0', id: ++id, method: 'initialize', params: { protocolVersion: '1999-01-01' } });
    assert.equal(r.result.protocolVersion, '2025-06-18');
  });

  it('an older supported protocol version is echoed back', async () => {
    const r = await srv.call({ jsonrpc: '2.0', id: ++id, method: 'initialize', params: { protocolVersion: '2025-03-26' } });
    assert.equal(r.result.protocolVersion, '2025-03-26');
  });

  it('stdout carried only JSON lines', () => {
    assert.ok(srv.lines.length > 20);
    for (const line of srv.lines) JSON.parse(line);
  });

  it('VELOXPDF_MCP_ALLOW_OUTSIDE_ROOT=1 permits a path outside the root', async () => {
    const s2 = startServer({ cwd: work, env: { VELOXPDF_MCP_ALLOW_OUTSIDE_ROOT: '1' } });
    try {
      await s2.call({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
      const target = path.join(outside, 'allowed.pdf');
      const r = await s2.call({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'render_pdf', arguments: { html: '<p>x</p>', output_path: target } },
      });
      assert.equal(r.result.isError, undefined);
      assert.ok(fs.existsSync(target));
    } finally {
      await s2.close();
    }
  });

  it('VELOXPDF_MCP_ROOT overrides the working directory as the root', async () => {
    const s3 = startServer({ cwd: os.tmpdir(), env: { VELOXPDF_MCP_ROOT: work } });
    try {
      await s3.call({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
      const r = await s3.call({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'verify_pdf', arguments: { path: 'plain-signed.pdf' } },
      });
      assert.equal(r.result.structuredContent.valid, true);
    } finally {
      await s3.close();
    }
  });
});
