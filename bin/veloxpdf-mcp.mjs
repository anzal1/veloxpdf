#!/usr/bin/env node
/**
 * VeloxPDF MCP server.
 *
 * Zero dependencies. Speaks MCP over stdio: JSON-RPC 2.0, one JSON message per line.
 * stdout carries protocol messages only. Diagnostics go to stderr.
 *
 * Tools: render_pdf, sign_pdf, verify_pdf, extract_pdf_data.
 *
 * File access: the server reads and writes only paths under a root folder.
 * The root is the current working directory, or VELOXPDF_MCP_ROOT when set.
 * Set VELOXPDF_MCP_ALLOW_OUTSIDE_ROOT=1 to lift the limit. Written files must end in .pdf.
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import {
  htmlToPdf,
  signPdf,
  verifyPdfSignature,
  extractEmbeddedData,
} from '../src/index.mjs';

const PKG = JSON.parse(
  fs.readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'),
);

const SUPPORTED_PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const LATEST_PROTOCOL = SUPPORTED_PROTOCOLS[0];
const MAX_INPUT_BYTES = 100 * 1024 * 1024;
const MAX_INLINE_RESULT_BYTES = 8 * 1024 * 1024;

const ALLOW_OUTSIDE = process.env.VELOXPDF_MCP_ALLOW_OUTSIDE_ROOT === '1';

const INSTRUCTIONS = [
  'VeloxPDF turns HTML, CSS and Tailwind into vector PDFs without a browser.',
  'Use render_pdf to make a PDF, sign_pdf to add an X.509 signature, verify_pdf to check one,',
  'and extract_pdf_data to read the JSON that render_pdf embedded.',
  'Files are limited to the server root folder. Rendering does not fetch remote images, so use data: URIs for images.',
].join(' ');

// ---------------------------------------------------------------------------
// Errors and path policy
// ---------------------------------------------------------------------------

class ToolError extends Error {}
class RpcError extends Error {
  constructor(code, message, data) {
    super(message);
    this.code = code;
    this.data = data;
  }
}

function realRoot() {
  const configured = process.env.VELOXPDF_MCP_ROOT;
  const base = configured ? path.resolve(configured) : process.cwd();
  return fs.realpathSync(base);
}

/** Nearest existing ancestor, resolved through symlinks, then the unresolved tail appended. */
function realpathLoose(p) {
  const tail = [];
  let cur = p;
  for (;;) {
    try {
      const real = fs.realpathSync(cur);
      return tail.length ? path.join(real, ...tail.reverse()) : real;
    } catch {
      const parent = path.dirname(cur);
      if (parent === cur) return p;
      tail.push(path.basename(cur));
      cur = parent;
    }
  }
}

function isInside(root, target) {
  const rel = path.relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function resolveSafePath(userPath, { forWrite }) {
  if (typeof userPath !== 'string' || userPath.length === 0) {
    throw new ToolError('Path must be a non-empty string.');
  }
  if (userPath.includes('\0')) throw new ToolError('Path contains a null byte.');
  const root = realRoot();
  if (!ALLOW_OUTSIDE && root === path.parse(root).root) {
    throw new ToolError(
      'The server root is the filesystem root, so no path limit applies. Start the server from a project folder, or set VELOXPDF_MCP_ROOT to the folder it may use.',
    );
  }
  const abs = realpathLoose(path.resolve(root, userPath));
  if (!ALLOW_OUTSIDE && !isInside(root, abs)) {
    throw new ToolError(
      `Path is outside the allowed folder (${root}). Use a path inside it, or start the server with VELOXPDF_MCP_ALLOW_OUTSIDE_ROOT=1.`,
    );
  }
  if (forWrite && path.extname(abs).toLowerCase() !== '.pdf') {
    throw new ToolError('Output path must end in .pdf.');
  }
  return abs;
}

function readPdf(userPath) {
  const abs = resolveSafePath(userPath, { forWrite: false });
  let st;
  try {
    st = fs.statSync(abs);
  } catch {
    throw new ToolError(`File not found: ${userPath}`);
  }
  if (!st.isFile()) throw new ToolError(`Not a file: ${userPath}`);
  if (st.size > MAX_INPUT_BYTES) throw new ToolError(`File is larger than ${MAX_INPUT_BYTES} bytes.`);
  const buf = fs.readFileSync(abs);
  if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') {
    throw new ToolError(`Not a PDF file (missing %PDF- header): ${userPath}`);
  }
  return { abs, bytes: new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength) };
}

function writePdf(userPath, bytes) {
  const abs = resolveSafePath(userPath, { forWrite: true });
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, bytes);
  return abs;
}

// ---------------------------------------------------------------------------
// Argument checks (a small subset of JSON Schema, enough for these tools)
// ---------------------------------------------------------------------------

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function needString(args, key, { required = false } = {}) {
  const v = args[key];
  if (v === undefined || v === null) {
    if (required) throw new ToolError(`Missing required argument "${key}".`);
    return undefined;
  }
  if (typeof v !== 'string') throw new ToolError(`Argument "${key}" must be a string.`);
  return v;
}

function needObject(value, name) {
  if (value === undefined || value === null) return undefined;
  if (!isPlainObject(value)) throw new ToolError(`Argument "${name}" must be an object.`);
  return value;
}

function needBool(value, name) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'boolean') throw new ToolError(`"${name}" must be true or false.`);
  return value;
}

function needNumber(value, name) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new ToolError(`"${name}" must be a non-negative number.`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    name: 'render_pdf',
    title: 'Render PDF',
    description:
      'Render an HTML, CSS or Tailwind document to a vector PDF. Supports {{ }} templates filled from "data", which is also embedded in the PDF as JSON. ' +
      'Optionally signs with an X.509 PKCS#7 signature. Writes the PDF to output_path when given, otherwise returns it as base64. ' +
      'Remote images are not fetched; use data: URIs. Inline scripts do not run unless options.runScripts is true.',
    inputSchema: {
      type: 'object',
      properties: {
        html: { type: 'string', description: 'HTML document or fragment. May contain <style>, Tailwind classes and {{ }} template fields.' },
        data: { type: 'object', description: 'Values for {{ }} template fields. Embedded in the PDF as JSON unless options.embedData is false.', additionalProperties: true },
        options: {
          type: 'object',
          description: 'Render options.',
          properties: {
            format: { type: 'string', enum: ['A4', 'Letter', 'Legal'], description: 'Page size. Default A4.' },
            orientation: { type: 'string', enum: ['portrait', 'landscape'] },
            width: { type: 'number', description: 'Page width in points. Overrides format.' },
            height: { type: 'number', description: 'Page height in points. Overrides format.' },
            margins: {
              description: 'Margins in points. A number for all sides, or an object. Default 36.',
              oneOf: [
                { type: 'number' },
                {
                  type: 'object',
                  properties: {
                    top: { type: 'number' },
                    right: { type: 'number' },
                    bottom: { type: 'number' },
                    left: { type: 'number' },
                  },
                  additionalProperties: false,
                },
              ],
            },
            headerText: { type: 'string', description: 'Running header on every page.' },
            footerText: { type: 'string', description: 'Running footer. Supports {{page}} and {{pages}}.' },
            css: { type: 'string', description: 'Extra CSS applied before the document styles.' },
            compress: { type: 'boolean', description: 'Compress page streams. Default false.' },
            singlePage: { type: 'boolean', description: 'Force everything onto one page.' },
            runScripts: { type: 'boolean', description: 'Run inline <script> and <canvas> code. Default false here.' },
            embedData: { type: 'boolean', description: 'Embed "data" as a JSON attachment. Default true.' },
            pdfa: { type: 'boolean', description: 'Write PDF/A-3b with embedded fonts. Default false.' },
            sign: {
              description: 'true signs with a generated self-signed certificate. An object also sets signer details.',
              oneOf: [
                { type: 'boolean' },
                {
                  type: 'object',
                  properties: {
                    signerName: { type: 'string' },
                    reason: { type: 'string' },
                    location: { type: 'string' },
                    org: { type: 'string' },
                  },
                  additionalProperties: false,
                },
              ],
            },
          },
          additionalProperties: false,
        },
        output_path: {
          type: 'string',
          description: 'Where to write the PDF. Relative paths resolve against the server root. Must end in .pdf. When omitted the PDF comes back as base64.',
        },
      },
      required: ['html'],
      additionalProperties: false,
    },
    handler: toolRenderPdf,
  },
  {
    name: 'sign_pdf',
    title: 'Sign PDF',
    description:
      'Add an X.509 PKCS#7 digital signature to an existing PDF as an incremental update, then write the signed copy to output_path. ' +
      'The certificate is generated and self-signed, so the signature shows the file was not changed since signing. It does not prove who signed. ' +
      'The signature is checked after writing and the result is reported.',
    inputSchema: {
      type: 'object',
      properties: {
        input_path: { type: 'string', description: 'PDF to sign.' },
        output_path: { type: 'string', description: 'Where to write the signed PDF. Must end in .pdf.' },
        signer_name: { type: 'string', description: 'Signer name. Default "VeloxPDF Authority".' },
        reason: { type: 'string', description: 'Reason recorded in the signature.' },
        location: { type: 'string', description: 'Location recorded in the signature.' },
      },
      required: ['input_path', 'output_path'],
      additionalProperties: false,
    },
    handler: toolSignPdf,
  },
  {
    name: 'verify_pdf',
    title: 'Verify PDF signature',
    description:
      'Check the digital signature of a PDF. Returns valid, tamperDetected, signer details, byte range and certificate fingerprint. ' +
      'An unsigned PDF returns valid false with an error message, not a tool failure.',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'PDF to check.' } },
      required: ['path'],
      additionalProperties: false,
    },
    handler: toolVerifyPdf,
  },
  {
    name: 'extract_pdf_data',
    title: 'Extract embedded JSON',
    description:
      'Read the JSON payload that render_pdf embedded in a PDF. Returns found false when the PDF has none.',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'PDF to read.' } },
      required: ['path'],
      additionalProperties: false,
    },
    handler: toolExtractPdfData,
  },
];

const TOOL_MAP = new Map(TOOLS.map((t) => [t.name, t]));

function ok(structured, text) {
  return {
    content: [{ type: 'text', text: text ?? JSON.stringify(structured) }],
    structuredContent: structured,
  };
}

function toolRenderPdf(args) {
  const html = needString(args, 'html', { required: true });
  const data = needObject(args.data, 'data');
  const opts = needObject(args.options, 'options') || {};
  const outputPath = needString(args, 'output_path');

  const render = { returnMetrics: true, runScripts: false };
  if (data) render.data = data;
  if (opts.format !== undefined) {
    if (!['A4', 'Letter', 'Legal'].includes(opts.format)) {
      throw new ToolError('options.format must be A4, Letter or Legal.');
    }
    render.format = opts.format;
  }
  if (opts.orientation !== undefined) {
    if (!['portrait', 'landscape'].includes(opts.orientation)) {
      throw new ToolError('options.orientation must be portrait or landscape.');
    }
    render.orientation = opts.orientation;
  }
  const width = needNumber(opts.width, 'options.width');
  const height = needNumber(opts.height, 'options.height');
  if (width !== undefined) render.width = width;
  if (height !== undefined) render.height = height;
  if (opts.margins !== undefined) {
    if (typeof opts.margins === 'number') {
      render.margins = needNumber(opts.margins, 'options.margins');
    } else if (isPlainObject(opts.margins)) {
      const m = {};
      for (const side of ['top', 'right', 'bottom', 'left']) {
        const v = needNumber(opts.margins[side], `options.margins.${side}`);
        if (v !== undefined) m[side] = v;
      }
      render.margins = m;
    } else {
      throw new ToolError('options.margins must be a number or an object.');
    }
  }
  for (const key of ['headerText', 'footerText', 'css']) {
    if (opts[key] !== undefined) {
      if (typeof opts[key] !== 'string') throw new ToolError(`options.${key} must be a string.`);
      render[key] = opts[key];
    }
  }
  for (const key of ['compress', 'singlePage', 'runScripts', 'embedData', 'pdfa']) {
    const v = needBool(opts[key], `options.${key}`);
    if (v !== undefined) render[key] = v;
  }
  let signed = false;
  if (opts.sign !== undefined && opts.sign !== false) {
    if (opts.sign === true) {
      render.sign = true;
    } else if (isPlainObject(opts.sign)) {
      const s = {};
      for (const key of ['signerName', 'reason', 'location', 'org']) {
        if (opts.sign[key] !== undefined) {
          if (typeof opts.sign[key] !== 'string') throw new ToolError(`options.sign.${key} must be a string.`);
          s[key] = opts.sign[key];
        }
      }
      render.sign = s;
    } else {
      throw new ToolError('options.sign must be true or an object.');
    }
    signed = true;
  }

  // Fail on a bad output path before spending time rendering.
  if (outputPath !== undefined) resolveSafePath(outputPath, { forWrite: true });

  let result;
  try {
    result = htmlToPdf(html, render);
  } catch (err) {
    throw new ToolError(`Render failed: ${err?.message || err}`);
  }
  const bytes = new Uint8Array(result.pdfBytes.buffer, result.pdfBytes.byteOffset, result.pdfBytes.byteLength);
  const summary = {
    pageCount: result.pageCount,
    byteLength: bytes.byteLength,
    elapsedMs: Math.round(result.elapsedMs * 1000) / 1000,
    signed,
  };

  if (outputPath !== undefined) {
    const abs = writePdf(outputPath, bytes);
    return ok({ ...summary, path: abs }, `Wrote ${abs} (${summary.pageCount} page(s), ${summary.byteLength} bytes${signed ? ', signed' : ''}).`);
  }
  if (bytes.byteLength > MAX_INLINE_RESULT_BYTES) {
    throw new ToolError(
      `The PDF is ${bytes.byteLength} bytes, too large to return inline. Pass output_path to write it to disk.`,
    );
  }
  const b64 = Buffer.from(bytes).toString('base64');
  return ok(
    { ...summary, mimeType: 'application/pdf', base64: b64 },
    JSON.stringify({ ...summary, mimeType: 'application/pdf', base64: b64 }),
  );
}

function toolSignPdf(args) {
  const inputPath = needString(args, 'input_path', { required: true });
  const outputPath = needString(args, 'output_path', { required: true });
  const signerName = needString(args, 'signer_name');
  const reason = needString(args, 'reason');
  const location = needString(args, 'location');

  const { bytes } = readPdf(inputPath);
  resolveSafePath(outputPath, { forWrite: true });

  const signOpts = {};
  if (signerName) signOpts.signerName = signerName;
  if (reason) signOpts.reason = reason;
  if (location) signOpts.location = location;

  let signedBytes;
  try {
    signedBytes = signPdf(bytes, signOpts);
  } catch (err) {
    throw new ToolError(`Signing failed: ${err?.message || err}`);
  }
  const check = verifyPdfSignature(signedBytes);
  const abs = writePdf(outputPath, signedBytes);
  const out = {
    path: abs,
    byteLength: signedBytes.byteLength,
    signerName: check.signerName,
    valid: check.valid,
    tamperDetected: check.tamperDetected,
  };
  return ok(out, `Signed copy written to ${abs} (${out.byteLength} bytes). Signature check after writing: ${check.valid ? 'valid' : 'NOT valid'}.`);
}

function toolVerifyPdf(args) {
  const p = needString(args, 'path', { required: true });
  const { abs, bytes } = readPdf(p);
  let result;
  try {
    result = verifyPdfSignature(bytes);
  } catch (err) {
    throw new ToolError(`Verification failed to run: ${err?.message || err}`);
  }
  const out = { path: abs, ...result };
  return ok(out, JSON.stringify(out));
}

function toolExtractPdfData(args) {
  const p = needString(args, 'path', { required: true });
  const { abs, bytes } = readPdf(p);
  let data;
  try {
    data = extractEmbeddedData(bytes);
  } catch (err) {
    throw new ToolError(`Extraction failed: ${err?.message || err}`);
  }
  const out = { path: abs, found: data !== null && data !== undefined, data: data ?? null };
  return ok(out, JSON.stringify(out));
}

// ---------------------------------------------------------------------------
// JSON-RPC plumbing
// ---------------------------------------------------------------------------

function send(message) {
  process.stdout.write(JSON.stringify(message) + '\n');
}

function reply(id, result) {
  send({ jsonrpc: '2.0', id, result });
}

function replyError(id, code, message, data) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  send({ jsonrpc: '2.0', id: id === undefined ? null : id, error });
}

function handleRequest(msg) {
  const { id, method } = msg;
  const params = msg.params;
  switch (method) {
    case 'initialize': {
      const asked = params && typeof params.protocolVersion === 'string' ? params.protocolVersion : null;
      const protocolVersion = asked && SUPPORTED_PROTOCOLS.includes(asked) ? asked : LATEST_PROTOCOL;
      return reply(id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'veloxpdf', title: 'VeloxPDF', version: PKG.version },
        instructions: INSTRUCTIONS,
      });
    }
    case 'ping':
      return reply(id, {});
    case 'tools/list':
      return reply(id, {
        tools: TOOLS.map(({ name, title, description, inputSchema }) => ({
          name,
          title,
          description,
          inputSchema,
        })),
      });
    case 'tools/call': {
      if (!isPlainObject(params) || typeof params.name !== 'string') {
        throw new RpcError(-32602, 'Invalid params: "name" is required.');
      }
      const tool = TOOL_MAP.get(params.name);
      if (!tool) throw new RpcError(-32602, `Unknown tool: ${params.name}`);
      const args = params.arguments === undefined ? {} : params.arguments;
      if (!isPlainObject(args)) throw new RpcError(-32602, 'Invalid params: "arguments" must be an object.');
      try {
        return reply(id, tool.handler(args));
      } catch (err) {
        if (err instanceof ToolError) {
          return reply(id, { content: [{ type: 'text', text: err.message }], isError: true });
        }
        process.stderr.write(`veloxpdf-mcp: tool ${params.name} crashed: ${err?.stack || err}\n`);
        return reply(id, {
          content: [{ type: 'text', text: `Unexpected error: ${err?.message || err}` }],
          isError: true,
        });
      }
    }
    default:
      throw new RpcError(-32601, `Method not found: ${method}`);
  }
}

function handleLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return;
  let msg;
  try {
    msg = JSON.parse(trimmed);
  } catch {
    return replyError(null, -32700, 'Parse error');
  }
  if (!isPlainObject(msg) || msg.jsonrpc !== '2.0') {
    return replyError(isPlainObject(msg) ? msg.id : null, -32600, 'Invalid Request: expected a JSON-RPC 2.0 object (batches are not supported).');
  }
  const isRequest = Object.prototype.hasOwnProperty.call(msg, 'id') && msg.id !== null;
  if (typeof msg.method !== 'string') {
    // A response from the client to a server request. This server sends none, so ignore it.
    if (isRequest) return;
    return replyError(null, -32600, 'Invalid Request: "method" is required.');
  }
  if (!isRequest) {
    // Notification (notifications/initialized, notifications/cancelled, ...). Never answered.
    return;
  }
  try {
    handleRequest(msg);
  } catch (err) {
    if (err instanceof RpcError) return replyError(msg.id, err.code, err.message, err.data);
    process.stderr.write(`veloxpdf-mcp: internal error: ${err?.stack || err}\n`);
    replyError(msg.id, -32603, 'Internal error');
  }
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', handleLine);
process.stderr.write(`veloxpdf-mcp ${PKG.version} ready on stdio (root: ${(() => { try { return realRoot(); } catch { return 'unavailable'; } })()})\n`);
