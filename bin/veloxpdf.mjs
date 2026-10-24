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
} from '../src/index.mjs';
// server.mjs generates a key and loads the Studio on import, so it is loaded only where needed.
const loadServer = () => import('../server.mjs');

const args = process.argv.slice(2);
const command = args[0];

function printHelp() {
  console.log(`
\x1b[1m\x1b[36mVeloxPDF\x1b[0m — Zero-Chromium HTML/CSS/Tailwind/Canvas2D to Signed Vector PDF 1.7

\x1b[1mUSAGE\x1b[0m
  $ veloxpdf <command> [options]

\x1b[1mCOMMANDS\x1b[0m
  \x1b[32mrender\x1b[0m <input.html> -o <out.pdf>   Compile HTML to native Vector PDF 1.7
  \x1b[32mverify\x1b[0m <file.pdf>                   Verify ISO 32000-1 X.509 PKCS#7 signature
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

\x1b[1mEXAMPLES\x1b[0m
  $ veloxpdf render invoice.html -o invoice.pdf --data data.json --sign
  $ veloxpdf render report.html -o report.pdf --header "CONFIDENTIAL" --footer "Page {{page}} of {{pages}}"
  $ veloxpdf verify signed-invoice.pdf
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

  const t0 = performance.now();
  const renderRes = htmlToPdf(htmlContent, {
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
      location: flags.location || 'San Francisco, US',
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
    if (res.signedAt || res.signingTime) console.log(`  \x1b[1mSigned At:\x1b[0m   ${res.signedAt || res.signingTime}`);
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
