#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  htmlToPdf,
  espressoRender,
  signPdf,
  verifyPdfSignature,
  generateSelfSignedCert,
  compilePdfTemplate,
  extractEmbeddedData,
  renderEInvoice,
  validateInvoice,
  EINVOICE_EXAMPLES,
} from '../src/index.mjs';
import zlib from 'node:zlib';
// server.mjs generates a key and loads the Studio on import, so it is loaded only where needed.
const loadServer = () => import('../server.mjs');

const args = process.argv.slice(2);
const command = args[0];

function printHelp() {
  console.log(`
\x1b[1m\x1b[36mVeloxPDF\x1b[0m: HTML, CSS and Tailwind to signed PDF, and EU e-invoices, without a browser

\x1b[1mUSAGE\x1b[0m
  $ veloxpdf <command> [options]

\x1b[1mCOMMANDS\x1b[0m
  \x1b[32mrender\x1b[0m <input.html> -o <out.pdf>   Compile HTML to native Vector PDF 1.7
  \x1b[32meinvoice\x1b[0m <invoice.json> -o <out.pdf> Build a Factur-X / ZUGFeRD / XRechnung PDF
  \x1b[32mverify\x1b[0m <file.pdf>                   Verify ISO 32000-1 X.509 PKCS#7 signature
  \x1b[32mextract\x1b[0m <file.pdf> [-o <file>]       Pull the embedded JSON or e-invoice XML out of a PDF
  \x1b[32mbench\x1b[0m                               Run live cold vs. warm vs. parametric benchmarks
  \x1b[32mserve\x1b[0m [--port 8585]                Launch VeloxPDF Studio Web UI

\x1b[1mRENDER OPTIONS\x1b[0m
  -o, --output <file>         Output PDF file path (default: output.pdf)
  -d, --data <file|json>      Template data JSON file or literal JSON string
  -s, --sign                  Cryptographically sign with X.509 PKCS#7 /ByteRange
  --signer <name>             Signer name (default: "VeloxPDF Authority")
  --reason <reason>           Signature reason string
  --location <location>       Signer geographic location
  --header <text>             Running header text on every page
  --footer <text>             Running footer text (supports "{{page}}" and "{{pages}}")
  --format <format>           Page format: A4, Letter, Legal, etc. (default: A4)
  --single-page               Force entire content onto a single page
  --compress                  Compress content streams with FlateDecode
  --ttf <file.ttf[:Family]>   Embed a TrueType font (family defaults to the file name before "-")

\x1b[1mEINVOICE OPTIONS\x1b[0m
  --example <name>            Write a starter invoice JSON instead (${Object.keys(EINVOICE_EXAMPLES).join(', ')})
  --profile <profile>         MINIMUM, BASICWL, BASIC, EN16931 (default) or XRECHNUNG
  -s, --sign                  Sign the e-invoice as well

\x1b[1mEXAMPLES\x1b[0m
  $ veloxpdf einvoice --example germanB2B -o invoice.json
  $ veloxpdf einvoice invoice.json -o invoice.pdf
  $ veloxpdf render invoice.html -o invoice.pdf --data data.json --sign
  $ veloxpdf render report.html -o report.pdf --header "CONFIDENTIAL" --footer "Page {{page}} of {{pages}}"
  $ veloxpdf verify signed-invoice.pdf
  $ veloxpdf extract invoice.pdf -o factur-x.xml
  $ veloxpdf bench
  $ veloxpdf serve --port 8585
`);
}

function parseFlags(rawArgs) {
  const flags = { _: [] };
  for (let i = 0; i < rawArgs.length; i++) {
    const a = rawArgs[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      if (i + 1 < rawArgs.length && !rawArgs[i + 1].startsWith('-')) {
        flags[key] = rawArgs[++i];
      } else {
        flags[key] = true;
      }
    } else if (a.startsWith('-')) {
      const key = a.slice(1);
      if (i + 1 < rawArgs.length && !rawArgs[i + 1].startsWith('-')) {
        flags[key] = rawArgs[++i];
      } else {
        flags[key] = true;
      }
    } else {
      flags._.push(a);
    }
  }
  return flags;
}

async function runRender(cmdArgs) {
  const flags = parseFlags(cmdArgs);
  const inputFile = flags._[0];

  if (!inputFile) {
    console.error('\x1b[31mError:\x1b[0m Missing input HTML file.');
    console.error('Usage: veloxpdf render <input.html> -o <out.pdf> [--data data.json] [--sign]');
    process.exit(1);
  }

  const outPath = flags.o || flags.output || 'output.pdf';

  if (!fs.existsSync(inputFile)) {
    console.error(`\x1b[31mError:\x1b[0m File not found: ${inputFile}`);
    process.exit(1);
  }

  const htmlContent = fs.readFileSync(inputFile, 'utf8');

  let dataObj = {};
  const dataFlag = flags.d || flags.data;
  if (dataFlag) {
    if (fs.existsSync(dataFlag)) {
      dataObj = JSON.parse(fs.readFileSync(dataFlag, 'utf8'));
    } else {
      try {
        dataObj = JSON.parse(dataFlag);
      } catch (e) {
        console.error(`\x1b[31mError parsing JSON data:\x1b[0m ${e.message}`);
        process.exit(1);
      }
    }
  }

  const shouldSign = Boolean(flags.s || flags.sign);
  const headerText = flags.header || undefined;
  const footerText = flags.footer || undefined;
  const format = flags.format || 'A4';
  const singlePage = Boolean(flags['single-page']);
  const compress = Boolean(flags.compress);

  // --ttf Inter-Regular.ttf registers family "Inter"; --ttf path.ttf:Family names it explicitly.
  let fonts;
  if (typeof flags.ttf === 'string') {
    const [ttfPath, family] = flags.ttf.split(/:(?=[^\\/]*$)/);
    if (!fs.existsSync(ttfPath)) {
      console.error(`\x1b[31mError:\x1b[0m Font file not found: ${ttfPath}`);
      process.exit(1);
    }
    const name = family || path.basename(ttfPath, path.extname(ttfPath)).split('-')[0];
    fonts = { [name]: fs.readFileSync(ttfPath) };
  }

  const t0 = performance.now();
  const renderRes = htmlToPdf(htmlContent, {
    fonts,
    data: dataObj,
    format,
    singlePage,
    compress,
    headerText,
    footerText,
    visualSeal: shouldSign,
    sign: shouldSign,
    returnMetrics: true,
  });
  const renderMs = performance.now() - t0;

  let finalBytes = renderRes.pdfBytes;
  let signMs = 0;
  let sigDetails = null;

  if (shouldSign) {
    const { defaultCert } = await loadServer();
    const ts0 = performance.now();
    finalBytes = signPdf(finalBytes, {
      certPem: defaultCert.certPem,
      keyPem: defaultCert.keyPem,
      signerName: flags.signer || 'VeloxPDF Authority',
      reason: flags.reason || 'Cryptographic Document Attestation',
      location: flags.location || '',
    });
    signMs = performance.now() - ts0;
    sigDetails = verifyPdfSignature(finalBytes);
  }

  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  fs.writeFileSync(outPath, Buffer.from(finalBytes));

  const sizeKb = (finalBytes.byteLength / 1024).toFixed(1);
  const totalMs = (renderMs + signMs).toFixed(3);

  console.log(`\x1b[32m✔ VeloxPDF Render Succeeded\x1b[0m`);
  console.log(`  \x1b[1mOutput:\x1b[0m      ${path.resolve(outPath)} (${sizeKb} KB, ${renderRes.pageCount || 1} page${renderRes.pageCount === 1 ? '' : 's'})`);
  console.log(`  \x1b[1mRender Time:\x1b[0m ${renderMs.toFixed(3)} ms`);
  if (shouldSign) {
    console.log(`  \x1b[1mX.509 Sign:\x1b[0m  ${signMs.toFixed(3)} ms (\x1b[32m${sigDetails?.valid ? 'VERIFIED' : 'PENDING'}\x1b[0m · ${flags.signer || 'VeloxPDF Authority'})`);
  }
  console.log(`  \x1b[1mTotal Time:\x1b[0m  ${totalMs} ms`);
}

// CMS signing times are ASN.1 UTCTime (YYMMDDHHMMSSZ) or GeneralizedTime (YYYYMMDDHHMMSSZ).
function formatSigningTime(raw) {
  const m = /^(\d{2}|\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/.exec(String(raw));
  if (!m) return String(raw);
  const year = m[1].length === 2 ? (Number(m[1]) < 50 ? 2000 : 1900) + Number(m[1]) : Number(m[1]);
  return `${year}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]} UTC`;
}

// Embedded files in our PDFs are JSON (velox-payload.json) or CII XML (factur-x.xml / xrechnung.xml).
function extractEmbeddedText(buf) {
  const json = extractEmbeddedData(buf);
  if (json) return { text: JSON.stringify(json, null, 2), kind: 'json' };
  const ef = buf.indexOf(Buffer.from('/Type /EmbeddedFile'));
  if (ef === -1) return null;
  let start = buf.indexOf(Buffer.from('stream'), ef);
  if (start === -1) return null;
  start += 6;
  if (buf[start] === 0x0d && buf[start + 1] === 0x0a) start += 2;
  else if (buf[start] === 0x0a) start += 1;
  const end = buf.indexOf(Buffer.from('endstream'), start);
  if (end === -1) return null;
  let raw = buf.subarray(start, end);
  try { raw = zlib.inflateSync(raw); } catch {}
  const text = raw.toString('utf8').trim();
  return { text, kind: text.startsWith('<') ? 'xml' : 'text' };
}

async function runExtract(cmdArgs) {
  const flags = parseFlags(cmdArgs);
  const pdfFile = flags._[0];
  if (!pdfFile || !fs.existsSync(pdfFile)) {
    console.error(`\x1b[31mError:\x1b[0m ${pdfFile ? `File not found: ${pdfFile}` : 'Missing PDF file path.'}`);
    console.error('Usage: veloxpdf extract <file.pdf> [-o out.json|out.xml]');
    process.exit(1);
  }
  const found = extractEmbeddedText(fs.readFileSync(pdfFile));
  if (!found) {
    console.error('\x1b[31mError:\x1b[0m This PDF has no embedded data.');
    process.exit(1);
  }
  const out = flags.o || flags.output;
  if (out) {
    fs.writeFileSync(out, found.text + '\n');
    console.log(`\x1b[32m✔\x1b[0m Wrote embedded ${found.kind.toUpperCase()} to ${path.resolve(out)}`);
  } else {
    process.stdout.write(found.text + '\n');
  }
}

async function runEInvoice(cmdArgs) {
  const flags = parseFlags(cmdArgs);
  const out = flags.o || flags.output;
  if (flags.example) {
    const ex = EINVOICE_EXAMPLES[flags.example === true ? 'germanB2B' : flags.example];
    if (!ex) {
      console.error(`\x1b[31mError:\x1b[0m Unknown example. Choose one of: ${Object.keys(EINVOICE_EXAMPLES).join(', ')}`);
      process.exit(1);
    }
    const target = out || 'invoice.json';
    fs.writeFileSync(target, JSON.stringify(ex.invoice, null, 2) + '\n');
    console.log(`\x1b[32m✔\x1b[0m Wrote a starter invoice to ${path.resolve(target)}`);
    console.log(`  Edit it, then run: veloxpdf einvoice ${target} -o invoice.pdf${ex.profile && ex.profile !== 'EN16931' ? ` --profile ${ex.profile}` : ''}`);
    return;
  }
  const inFile = flags._[0];
  if (!inFile || !fs.existsSync(inFile)) {
    console.error(`\x1b[31mError:\x1b[0m ${inFile ? `File not found: ${inFile}` : 'Missing invoice JSON file.'}`);
    console.error('Usage: veloxpdf einvoice <invoice.json> -o invoice.pdf   (or --example germanB2B for a starter file)');
    process.exit(1);
  }
  let invoice;
  try {
    invoice = JSON.parse(fs.readFileSync(inFile, 'utf8'));
  } catch (err) {
    console.error(`\x1b[31mError:\x1b[0m ${inFile} is not valid JSON (${err.message})`);
    process.exit(1);
  }
  const profile = typeof flags.profile === 'string' ? flags.profile : 'EN16931';
  const problems = validateInvoice(invoice, profile) || [];
  if (problems.length) {
    console.error(`\x1b[31m✖ The invoice is missing ${problems.length} required field${problems.length === 1 ? '' : 's'} for ${profile}:\x1b[0m`);
    for (const p of problems) console.error(`  - ${p.message || p}`);
    process.exit(1);
  }
  const t0 = performance.now();
  const pdf = renderEInvoice(invoice, { profile, sign: Boolean(flags.sign || flags.s) });
  const ms = (performance.now() - t0).toFixed(1);
  const target = out || inFile.replace(/\.json$/i, '') + '.pdf';
  fs.writeFileSync(target, pdf);
  console.log(`\x1b[32m✔\x1b[0m ${path.resolve(target)}`);
  console.log(`  PDF/A-3b with the ${profile} XML embedded, ${(pdf.length / 1024).toFixed(1)} KB, ${ms} ms`);
  if (pdf.totals?.grandTotal) console.log(`  Total due: ${pdf.totals.grandTotal} ${invoice.currency || ''}`.trimEnd());
}

async function runVerify(cmdArgs) {
  const flags = parseFlags(cmdArgs);
  const pdfFile = flags._[0];

  if (!pdfFile) {
    console.error('\x1b[31mError:\x1b[0m Missing PDF file path to verify.');
    console.error('Usage: veloxpdf verify <file.pdf>');
    process.exit(1);
  }

  if (!fs.existsSync(pdfFile)) {
    console.error(`\x1b[31mError:\x1b[0m File not found: ${pdfFile}`);
    process.exit(1);
  }

  const pdfBuf = fs.readFileSync(pdfFile);
  const t0 = performance.now();
  const res = verifyPdfSignature(pdfBuf);
  const verifyMs = (performance.now() - t0).toFixed(3);

  if (res.valid) {
    console.log(`\x1b[32m✔ Cryptographic Signature VERIFIED (ISO 32000-1 / PKCS#7)\x1b[0m`);
    console.log(`  \x1b[1mFile:\x1b[0m        ${path.resolve(pdfFile)}`);
    console.log(`  \x1b[1mSigner:\x1b[0m      ${res.signerName || 'VeloxPDF Authority'}`);
    console.log(`  \x1b[1mReason:\x1b[0m      ${res.reason || 'Cryptographic Attestation'}`);
    if (res.location) console.log(`  \x1b[1mLocation:\x1b[0m    ${res.location}`);
    if (res.signedAt || res.signingTime) console.log(`  \x1b[1mSigned At:\x1b[0m   ${formatSigningTime(res.signedAt || res.signingTime)}`);
    if (res.byteRange) console.log(`  \x1b[1mByteRange:\x1b[0m   [${res.byteRange.join(', ')}]`);
    console.log(`  \x1b[1mSubFilter:\x1b[0m   ${res.subFilter || 'adbe.pkcs7.detached'}`);
    if (res.digestHex) console.log(`  \x1b[1mSHA-256:\x1b[0m     ${res.digestHex.slice(0, 32)}...`);
    console.log(`  \x1b[1mVerify Time:\x1b[0m ${verifyMs} ms`);
    process.exit(0);
  } else {
    console.error(`\x1b[31m✖ Signature Verification FAILED / TAMPER DETECTED\x1b[0m`);
    console.error(`  \x1b[1mFile:\x1b[0m        ${path.resolve(pdfFile)}`);
    console.error(`  \x1b[1mError:\x1b[0m       ${res.error || 'Cryptographic digest mismatch: file has been modified after signing'}`);
    console.error(`  \x1b[1mVerify Time:\x1b[0m ${verifyMs} ms`);
    process.exit(1);
  }
}

async function runBench(cmdArgs) {
  const flags = parseFlags(cmdArgs);
  const iterations = parseInt(flags.n || flags.iterations || '50', 10);

  console.log(`\x1b[1m\x1b[36mRunning VeloxPDF Performance Benchmark\x1b[0m (${iterations} iterations)...`);
  console.log('Every number below is measured on this machine; nothing is estimated.\n');

  const { PRESETS } = await loadServer();
  const template = PRESETS.invoice.template;
  const data = PRESETS.invoice.data;

  // 1. Cold Render
  const tCold0 = performance.now();
  htmlToPdf(template, { data, format: 'A4', compress: false });
  const coldMs = performance.now() - tCold0;

  // 2. Warmup
  for (let i = 0; i < 10; i++) {
    htmlToPdf(template, { data, format: 'A4', compress: false });
  }

  // 3. Warm Benchmark
  const warmTimes = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    htmlToPdf(template, { data, format: 'A4', compress: false });
    warmTimes.push(performance.now() - t0);
  }
  warmTimes.sort((a, b) => a - b);
  const warmP50 = warmTimes[Math.floor(warmTimes.length * 0.5)];
  const warmP95 = warmTimes[Math.floor(warmTimes.length * 0.95)];
  const warmAvg = warmTimes.reduce((a, b) => a + b, 0) / warmTimes.length;
  const warmPagesSec = Math.round(1000 / Math.max(0.001, warmAvg));

  // 4. Parametric Compiler
  const compiled = compilePdfTemplate(template, data);
  for (let i = 0; i < 10; i++) compiled(data);

  const paramTimes = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    compiled(data);
    paramTimes.push(performance.now() - t0);
  }
  paramTimes.sort((a, b) => a - b);
  const paramP50 = paramTimes[Math.floor(paramTimes.length * 0.5)];
  const paramP95 = paramTimes[Math.floor(paramTimes.length * 0.95)];
  const paramAvg = paramTimes.reduce((a, b) => a + b, 0) / paramTimes.length;
  const paramPagesSec = Math.round(1000 / Math.max(0.001, paramAvg));

  const row = (label, p50, p95, pagesSec) =>
    `│ ${label.padEnd(36)} │ ${(p50.toFixed(2) + ' ms').padStart(11)} │ ${(p95 == null ? 'n/a' : p95.toFixed(2) + ' ms').padStart(11)} │ ${(pagesSec.toLocaleString() + ' /s').padStart(12)} │`;

  console.log('┌──────────────────────────────────────┬─────────────┬─────────────┬──────────────┐');
  console.log('│ Path                                 │ p50         │ p95         │ PDFs per sec │');
  console.log('├──────────────────────────────────────┼─────────────┼─────────────┼──────────────┤');
  console.log(row('Cold render (first run, single)', coldMs, null, Math.round(1000 / Math.max(0.01, coldMs))));
  console.log(row('Warm render (htmlToPdf)', warmP50, warmP95, warmPagesSec));
  console.log(row('Compiled template (precompiled)', paramP50, paramP95, paramPagesSec));
  console.log('└──────────────────────────────────────┴─────────────┴─────────────┴──────────────┘');
  console.log(`\nMeasured with Node ${process.version} on ${process.platform}/${process.arch}, invoice preset, ${iterations} iterations.`);
  console.log('To compare with headless Chrome, time your own Puppeteer or Playwright page.pdf() on the same template and machine.');
}

async function runServe(cmdArgs) {
  const flags = parseFlags(cmdArgs);
  const port = parseInt(flags.port || flags.p || process.env.PORT || '8585', 10);
  const { createServer } = await loadServer();
  const app = createServer(port);
  app.listen(port, (p) => {
    console.log(`\x1b[32m✔\x1b[0m VeloxPDF Studio live at \x1b[1m\x1b[36mhttp://127.0.0.1:${p}\x1b[0m`);
    console.log(`  Interactive Studio, 5 Presets, X.509 1-Byte Tamper Sandbox, and Live Benchmark`);
  });
}

// Router
switch (command) {
  case 'render':
    await runRender(args.slice(1));
    break;
  case 'verify':
    await runVerify(args.slice(1));
    break;
  case 'extract':
    await runExtract(args.slice(1));
    break;
  case 'einvoice':
  case 'e-invoice':
    await runEInvoice(args.slice(1));
    break;
  case 'bench':
  case 'benchmark':
    await runBench(args.slice(1));
    break;
  case 'serve':
  case 'studio':
  case 'start':
    await runServe(args.slice(1));
    break;
  case '--help':
  case '-h':
  case 'help':
  case undefined:
    printHelp();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exit(1);
}
