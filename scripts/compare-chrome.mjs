#!/usr/bin/env node
// VeloxPDF vs headless Chrome, same invoice, same machine.
//
//   node scripts/compare-chrome.mjs                 # full comparison (needs playwright-core)
//   node scripts/compare-chrome.mjs --velox-only    # VeloxPDF numbers only, no Chrome
//   node scripts/compare-chrome.mjs --warm 50 --cold 10
//
// Environment:
//   CHROME_PATH            path to a Chrome / Chromium / chrome-headless-shell binary
//   PLAYWRIGHT_CORE_PATH   path to an installed playwright-core package (optional)
//
// playwright-core is NOT a dependency of this repo. Install it anywhere you like
// (for example `npm i playwright-core` in a scratch folder and run this script from there).
//
// Fairness rules:
//  - Chrome and VeloxPDF receive the same final HTML (the template is expanded once with the
//    same data for Chrome; VeloxPDF also gets the raw template + data for its own paths).
//  - Both sides use A4 with 36pt (0.5in) margins and produce the PDF bytes in memory.
//  - The plain-CSS fixture (scripts/fixtures/plain-invoice.html) is used because Chrome cannot
//    resolve Tailwind utility classes without Tailwind's own CSS. The Tailwind invoice preset
//    from server.mjs is timed on the VeloxPDF side only and labelled as such.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import v8 from 'node:v8';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { PRESETS } from '../server.mjs';
import { compileTemplate } from '../src/dom-vm.mjs';
import {
  htmlToPdf,
  compilePdfTemplate,
  signPdf,
  verifyPdfSignature,
  extractEmbeddedData,
  generateSelfSignedCert,
} from '../src/index.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------- args

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const WARM_RUNS = Math.max(5, parseInt(flag('warm', '30'), 10));
const COLD_RUNS = Math.max(3, parseInt(flag('cold', '7'), 10));
const VELOX_ONLY = argv.includes('--velox-only');
const MARGIN_PT = 36;

// ---------------------------------------------------------------- helpers

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const pct = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))];
};
const fmtMs = (ms) => (ms >= 10 ? ms.toFixed(1) : ms >= 1 ? ms.toFixed(2) : ms.toFixed(3)) + ' ms';
const perSec = (ms) => Math.round(1000 / ms).toLocaleString('en-US');
const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1) + ' MB';

function time(fn, runs, warmup = 5) {
  for (let i = 0; i < warmup; i++) fn();
  const out = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    fn();
    out.push(performance.now() - t0);
  }
  return out;
}

function forceGc() {
  try {
    v8.setFlagsFromString('--expose-gc');
    vm.runInNewContext('gc')();
  } catch {}
}

function pageCountOf(bytes) {
  const m = Buffer.from(bytes).toString('latin1').match(/\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)|\/Count\s+(\d+)[^>]*?\/Type\s*\/Pages\b/);
  return m ? Number(m[1] || m[2]) : 0;
}

// Sum of resident memory of every descendant of a process (macOS and Linux `ps`). Shared pages are counted per
// process, so this slightly overstates the real footprint.
function treeRssBytes(rootPid) {
  try {
    const rows = execFileSync('ps', ['-axo', 'pid=,ppid=,rss='], { encoding: 'utf8' })
      .trim()
      .split('\n')
      .map((l) => l.trim().split(/\s+/).map(Number));
    const kids = new Map();
    for (const [pid, ppid, rss] of rows) {
      if (!kids.has(ppid)) kids.set(ppid, []);
      kids.get(ppid).push([pid, rss]);
    }
    let total = 0;
    const stack = [rootPid];
    const seen = new Set();
    while (stack.length) {
      const p = stack.pop();
      if (seen.has(p)) continue;
      seen.add(p);
      const self = rows.find((r) => r[0] === p);
      if (self && p !== rootPid) total += self[2] * 1024; // descendants only
      for (const [kid] of kids.get(p) || []) stack.push(kid);
    }
    return total;
  } catch {
    return null;
  }
}

async function loadPlaywright() {
  const attempts = [
    () => import('playwright-core'),
    () => {
      const req = createRequire(path.join(process.cwd(), 'noop.js'));
      return import(pathToFileURL(req.resolve('playwright-core')).href);
    },
    () => {
      if (!process.env.PLAYWRIGHT_CORE_PATH) throw new Error('no PLAYWRIGHT_CORE_PATH');
      const req = createRequire(path.join(path.resolve(process.env.PLAYWRIGHT_CORE_PATH), 'noop.js'));
      return import(pathToFileURL(req.resolve(path.resolve(process.env.PLAYWRIGHT_CORE_PATH))).href);
    },
  ];
  for (const attempt of attempts) {
    try {
      const mod = await attempt();
      return mod.chromium || mod.default?.chromium;
    } catch {}
  }
  return null;
}

// ---------------------------------------------------------------- the invoice

const TEMPLATE = fs.readFileSync(path.join(HERE, 'fixtures', 'plain-invoice.html'), 'utf8');
const DATA = {
  Company: 'Northwind Studio',
  CompanyStreet: '12345 Sunny Road',
  CompanyCity: 'Sunnyville, CA 12345',
  InvoiceNumber: 'INV-2026-0412',
  Created: 'October 24, 2026',
  Due: 'November 24, 2026',
  CustomerName: 'Acme Corp.',
  CustomerContact: 'Jane Doe',
  CustomerEmail: 'jane@example.com',
  PaymentMethod: 'Bank transfer',
  CheckNumber: '1000',
  Items: [
    { Name: 'Website design', Price: '$300.00' },
    { Name: 'Hosting (3 months)', Price: '$75.00' },
    { Name: 'Domain name (1 year)', Price: '$10.00' },
  ],
  Total: '$385.00',
};
const HTML = compileTemplate(TEMPLATE, DATA); // the exact HTML Chrome gets
const VELOX_OPTS = { format: 'A4', margins: MARGIN_PT };

// ---------------------------------------------------------------- VeloxPDF

function measureVelox() {
  const baseRss = process.memoryUsage().rss;
  forceGc();
  const baseHeap = process.memoryUsage().heapUsed;

  // Cold: first render in this process, template and data fresh.
  const t0 = performance.now();
  const first = htmlToPdf(TEMPLATE, { ...VELOX_OPTS, data: DATA });
  const cold = performance.now() - t0;

  const warm = time(() => htmlToPdf(TEMPLATE, { ...VELOX_OPTS, data: DATA }), WARM_RUNS);
  const renderCompiled = compilePdfTemplate(TEMPLATE, DATA, VELOX_OPTS);
  const compiled = time(() => renderCompiled(DATA), Math.max(WARM_RUNS, 200), 20);

  // Memory: 200 more renders, then measure growth against the start.
  for (let i = 0; i < 200; i++) htmlToPdf(TEMPLATE, { ...VELOX_OPTS, data: DATA });
  const rssAfter = process.memoryUsage().rss;
  forceGc();
  const heapAfter = process.memoryUsage().heapUsed;

  return {
    cold,
    warm,
    compiled,
    pages: pageCountOf(first),
    bytes: first.byteLength,
    rssGrowth: Math.max(0, rssAfter - baseRss),
    heapGrowth: Math.max(0, heapAfter - baseHeap),
    rss: rssAfter,
  };
}

function measureVeloxExtras() {
  const p = PRESETS.invoice;
  const opts = { data: p.data, format: 'A4' };
  const warm = time(() => htmlToPdf(p.template, opts), Math.max(WARM_RUNS, 100));
  const renderCompiled = compilePdfTemplate(p.template, p.data);
  const compiled = time(() => renderCompiled(p.data), 300, 20);

  const cert = generateSelfSignedCert({ commonName: 'VeloxPDF Authority', org: 'VeloxPDF' });
  const base = htmlToPdf(p.template, opts);
  const signOpts = { certPem: cert.certPem, keyPem: cert.keyPem, signerName: 'Billing', reason: 'Invoice' };
  const sign = time(() => signPdf(base, signOpts), 100);
  const signed = signPdf(base, signOpts);
  const verify = time(() => verifyPdfSignature(signed), 100);
  const extract = time(() => extractEmbeddedData(signed), 100);
  const verifyOk = verifyPdfSignature(signed).valid === true;
  const payloadOk = extractEmbeddedData(signed)?.InvoiceNumber === p.data.InvoiceNumber;

  // 100 different customers through one precompiled template.
  const rows = Array.from({ length: 100 }, (_, i) => ({
    ...p.data,
    InvoiceNumber: `INV-2026-${String(10000 + i)}`,
    CustomerName: `Customer ${i + 1}`,
  }));
  const batch = [];
  for (let r = 0; r < 60; r++) {
    const t0 = performance.now();
    for (const row of rows) renderCompiled(row);
    batch.push(performance.now() - t0);
  }
  const batch100 = batch.slice(10); // first runs are JIT warm-up

  const pages = renderCompiled(rows[7]);
  const batchDistinct =
    Buffer.from(renderCompiled(rows[1])).toString('latin1') !== Buffer.from(pages).toString('latin1');

  return { warm, compiled, sign, verify, extract, batch100, verifyOk, payloadOk, batchDistinct };
}

// ---------------------------------------------------------------- Chrome

async function measureChrome(chromium) {
  const executablePath = process.env.CHROME_PATH || undefined;
  const args = ['--mute-audio', '--disable-gpu', '--no-first-run'];
  const m = `${MARGIN_PT / 72}in`; // Playwright accepts px, in, cm, mm (not pt)
  const pdfOpts = { format: 'A4', printBackground: true, margin: { top: m, right: m, bottom: m, left: m } };

  // Cold: launch + new page + load HTML + page.pdf(). Closing is outside the timer.
  const cold = [];
  let sample = null;
  for (let i = 0; i < COLD_RUNS; i++) {
    const t0 = performance.now();
    const browser = await chromium.launch({ executablePath, args });
    try {
      const page = await browser.newPage();
      await page.setContent(HTML, { waitUntil: 'load' });
      sample = await page.pdf(pdfOpts);
      cold.push(performance.now() - t0);
    } finally {
      await browser.close();
    }
  }

  // Warm: one browser and one page, reused. Each iteration reloads the HTML and prints.
  const browser = await chromium.launch({ executablePath, args });
  let warm = [];
  let version = '';
  let rss = null;
  try {
    const page = await browser.newPage();
    const once = async () => {
      await page.setContent(HTML, { waitUntil: 'load' });
      return page.pdf(pdfOpts);
    };
    for (let i = 0; i < 5; i++) await once();
    for (let i = 0; i < WARM_RUNS; i++) {
      const t0 = performance.now();
      sample = await once();
      warm.push(performance.now() - t0);
    }
    version = browser.version();
    rss = treeRssBytes(process.pid);
  } finally {
    await browser.close();
  }

  return {
    cold,
    warm,
    version,
    pages: pageCountOf(sample),
    bytes: sample.byteLength,
    treeRss: rss,
  };
}

// ---------------------------------------------------------------- run

console.log(`VeloxPDF vs headless Chrome`);
console.log(`Machine: ${os.cpus()[0]?.model || os.arch()} | ${os.platform()}/${os.arch()} | Node ${process.version}`);
console.log(`Warm runs: ${WARM_RUNS}, Chrome cold runs: ${COLD_RUNS}. Fixture: scripts/fixtures/plain-invoice.html (A4, ${MARGIN_PT}pt margins)\n`);

const velox = measureVelox();
const veloxWarmMed = median(velox.warm);
const veloxCompMed = median(velox.compiled);

let chrome = null;
if (!VELOX_ONLY) {
  const chromium = await loadPlaywright();
  if (!chromium) {
    console.log('Chrome side skipped: install playwright-core to run this comparison');
    console.log('  npm i playwright-core   (in any folder, then run this script from there,');
    console.log('  or point PLAYWRIGHT_CORE_PATH at the package), and set CHROME_PATH to a Chrome binary.');
    console.log('Use --velox-only to print only the VeloxPDF numbers.\n');
  } else {
    try {
      chrome = await measureChrome(chromium);
    } catch (err) {
      console.log(`Chrome side failed: ${String(err.message || err).split('\n')[0]}`);
      console.log('Set CHROME_PATH to a Chrome / Chromium / chrome-headless-shell binary, or run');
      console.log('`npx playwright-core install chromium-headless-shell`.\n');
    }
  }
}

const rows = [];
if (chrome) {
  const cold = median(chrome.cold);
  const warm = median(chrome.warm);
  rows.push(['Chrome cold (launch + render)', cold, pct(chrome.cold, 0.95), null]);
  rows.push(['Chrome warm (browser + page reused)', warm, pct(chrome.warm, 0.95), null]);
}
rows.push(['VeloxPDF warm (htmlToPdf)', veloxWarmMed, pct(velox.warm, 0.95), null]);
rows.push(['VeloxPDF precompiled (compilePdfTemplate)', veloxCompMed, pct(velox.compiled, 0.95), null]);

console.log(`Same plain-CSS invoice, median of runs (VeloxPDF cold first render: ${fmtMs(velox.cold)})`);
const w = Math.max(...rows.map((r) => r[0].length));
console.log(`${'Path'.padEnd(w)}   ${'p50'.padStart(10)}   ${'p95'.padStart(10)}   ${'PDFs/sec'.padStart(9)}   vs Chrome warm`);
for (const [label, p50, p95] of rows) {
  const vs = chrome ? `${(median(chrome.warm) / p50).toFixed(1)}x` : '';
  console.log(`${label.padEnd(w)}   ${fmtMs(p50).padStart(10)}   ${fmtMs(p95).padStart(10)}   ${perSec(p50).padStart(9)}   ${vs}`);
}
console.log('');

if (chrome) {
  const coldMed = median(chrome.cold);
  const warmMed = median(chrome.warm);
  console.log(`Chrome: ${chrome.version}${process.env.CHROME_PATH ? ' (CHROME_PATH)' : ''}`);
  console.log(`Output: Chrome ${chrome.pages} page(s) ${(chrome.bytes / 1024).toFixed(1)} KB | VeloxPDF ${velox.pages} page(s) ${(velox.bytes / 1024).toFixed(1)} KB`);
  console.log(`Ratios (median): VeloxPDF warm is ${(warmMed / veloxWarmMed).toFixed(1)}x faster than Chrome warm and ${(coldMed / veloxWarmMed).toFixed(0)}x faster than Chrome cold.`);
  console.log(`                 VeloxPDF precompiled is ${(warmMed / veloxCompMed).toFixed(0)}x faster than Chrome warm and ${(veloxWarmMed / veloxCompMed).toFixed(0)}x faster than VeloxPDF warm.`);
  if (chrome.treeRss) {
    console.log(`Memory: Chrome process tree ${mb(chrome.treeRss)} summed RSS (shared pages counted per process).`);
  }
  console.log(`        VeloxPDF after 200 more renders: process RSS ${mb(velox.rss)}, RSS growth ${mb(velox.rssGrowth)}, heap growth ${mb(velox.heapGrowth)}.`);
  console.log('');
} else {
  console.log(`Output: VeloxPDF ${velox.pages} page(s) ${(velox.bytes / 1024).toFixed(1)} KB`);
  console.log(`Memory: VeloxPDF after 200 more renders: process RSS ${mb(velox.rss)}, RSS growth ${mb(velox.rssGrowth)}, heap growth ${mb(velox.heapGrowth)}.\n`);
}

// VeloxPDF only: the Tailwind invoice preset, signing, verification, batch.
const x = measureVeloxExtras();
console.log('VeloxPDF only, Tailwind invoice preset from server.mjs (Chrome needs Tailwind CSS to render it, so it is not compared)');
const line = (label, xs, per = true) =>
  console.log(`  ${label.padEnd(44)} p50 ${fmtMs(median(xs)).padStart(9)}   p95 ${fmtMs(pct(xs, 0.95)).padStart(9)}${per ? `   ${perSec(median(xs)).padStart(7)}/s` : ''}`);
line('htmlToPdf warm', x.warm);
line('compilePdfTemplate render', x.compiled);
line('signPdf (RSA-SHA256, PKCS#7)', x.sign);
line('verifyPdfSignature', x.verify);
line('extractEmbeddedData', x.extract);
line('100 documents through one compiled template', x.batch100, false);
console.log(`  checks: signature valid ${x.verifyOk}, embedded JSON round-trip ${x.payloadOk}, batch outputs differ per row ${x.batchDistinct}`);

process.exit(0);
