#!/usr/bin/env node
// Fidelity score: VeloxPDF against headless Chrome on real open-source invoice templates.
//
//   node scripts/fidelity/run.mjs [--only name] [--out DIR] [--write-results] [--baseline earlier/results.json]
//
// Environment:
//   CHROME_PATH            Chrome / chrome-headless-shell binary (required)
//   PLAYWRIGHT_CORE_PATH   folder of an installed playwright-core (not a dependency of this repo)
//   PYTHON                 python3 with Pillow (default python3)
//
// For each fixture in scripts/fidelity/fixtures/*.html both engines make an A4 PDF with 0.5in margins.
// Scores (all 0 to 1):
//   text    share of Chrome's words that VeloxPDF draws as a visible box inside the page (all pages)
//   layout  SSIM of page 1, grayscale, 300px wide, 8x8 windows
//   pages   1 if the page counts match, else the smaller over the larger
//   score   0.4 text + 0.4 layout + 0.2 pages
// Output: scripts/fidelity/results.md (with --write-results) and side-by-side PNGs (Chrome left, VeloxPDF right).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { renderPdfAsync } from '../../src/index.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(HERE, 'fixtures');
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const OUT = flag('out', path.join(os.tmpdir(), 'veloxpdf-fidelity'));
const ONLY = flag('only', null);
const PYTHON = process.env.PYTHON || 'python3';
const BASELINE = flag('baseline', null) ? JSON.parse(fs.readFileSync(flag('baseline'), 'utf8')) : null;
const baseOf = (name) => BASELINE?.find((r) => r.name === name);

async function loadChromium() {
  const tries = [
    () => import('playwright-core'),
    () => import(pathToFileURL(createRequire(path.join(process.cwd(), 'x.js')).resolve('playwright-core')).href),
    () => import(pathToFileURL(createRequire(path.join(path.resolve(process.env.PLAYWRIGHT_CORE_PATH || '.'), 'x.js')).resolve('playwright-core')).href),
  ];
  for (const t of tries) { try { const m = await t(); return m.chromium || m.default?.chromium; } catch {} }
  throw new Error('playwright-core not found. Set PLAYWRIGHT_CORE_PATH.');
}

fs.mkdirSync(OUT, { recursive: true });
const names = fs.readdirSync(FIX).filter((f) => f.endsWith('.html')).map((f) => f.slice(0, -5)).filter((n) => !ONLY || n === ONLY).sort();
const chromium = await loadChromium();
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ['--mute-audio', '--no-sandbox'] });
const rows = [];
try {
  for (const name of names) {
    const file = path.join(FIX, `${name}.html`);
    const html = fs.readFileSync(file, 'utf8');
    const veloxPdf = path.join(OUT, `${name}-velox.pdf`);
    const chromePdf = path.join(OUT, `${name}-chrome.pdf`);
    const row = { name, error: null };
    try {
      const t0 = performance.now();
      const bytes = await renderPdfAsync(html, { format: 'A4', margins: 36, baseDir: FIX });
      row.veloxMs = performance.now() - t0;
      fs.writeFileSync(veloxPdf, bytes);
    } catch (e) { row.error = `velox: ${e.message}`; rows.push(row); continue; }
    const page = await browser.newPage();
    try {
      await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
      await page.pdf({ path: chromePdf, format: 'A4', printBackground: true, margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' } });
    } finally { await page.close(); }
    const json = execFileSync('nice', ['-n', '10', PYTHON, '-I', path.join(HERE, 'score.py'), chromePdf, veloxPdf, path.join(OUT, name)], { encoding: 'utf8' });
    Object.assign(row, JSON.parse(json));
    const pagesScore = row.chrome_pages === row.velox_pages ? 1 : Math.min(row.chrome_pages, row.velox_pages) / Math.max(row.chrome_pages, row.velox_pages);
    row.pagesScore = pagesScore;
    row.score = 0.4 * row.text_coverage + 0.4 * row.ssim + 0.2 * pagesScore;
    rows.push(row);
    console.log(`${name.padEnd(28)} text ${(row.text_coverage * 100).toFixed(0).padStart(3)}%  layout ${row.ssim.toFixed(2)}  pages ${row.velox_pages}/${row.chrome_pages}  lost ${row.lost_count}  overlaps +${row.extra_overlaps}  score ${(row.score * 100).toFixed(0)}`);
    if (argv.includes('--verbose')) { if (row.lost_count) console.log('    lost:', row.lost_words.join(' ')); if (row.overlap_pairs.length) console.log('    overlaps:', row.overlap_pairs.join(' | ')); }
  }
} finally { await browser.close(); }

const ok = rows.filter((r) => !r.error);
const mean = (k) => ok.reduce((a, r) => a + r[k], 0) / (ok.length || 1);
const overall = mean('score');
console.log(`lost words total ${ok.reduce((a, r) => a + r.lost_count, 0)}, extra overlaps total ${ok.reduce((a, r) => a + r.extra_overlaps, 0)}`);
console.log(`overall ${(overall * 100).toFixed(1)}  (text ${(mean('text_coverage') * 100).toFixed(1)}%, layout ${mean('ssim').toFixed(3)}, pages match ${ok.filter((r) => r.chrome_pages === r.velox_pages).length}/${ok.length})`);

if (argv.includes('--write-results')) {
  const L = [];
  L.push('# VeloxPDF fidelity against Chrome', '');
  L.push('Real MIT-licensed invoice and receipt templates (sources in fixtures/SOURCES.md), rendered by VeloxPDF and by headless Chrome at A4 with 0.5in margins.', '');
  L.push(`**Overall fidelity score: ${(overall * 100).toFixed(1)} / 100** over ${ok.length} templates.`, '');
  L.push(`- Text coverage (share of Chrome's words VeloxPDF draws visibly inside the page): ${(mean('text_coverage') * 100).toFixed(1)}%`);
  L.push(`- Layout similarity (SSIM of page 1, grayscale, 300px wide): ${mean('ssim').toFixed(3)}`);
  L.push(`- Page count matches Chrome: ${ok.filter((r) => r.chrome_pages === r.velox_pages).length} of ${ok.length}`);
  L.push('- Template score = 0.4 text + 0.4 layout + 0.2 page count match', '');
  if (BASELINE) {
    const bok = BASELINE.filter((r) => !r.error);
    L.splice(2, 0, `Before the fixes in this change: ${(bok.reduce((a, r) => a + r.score, 0) / bok.length * 100).toFixed(1)} / 100.`, '');
  }
  L.push(`- Lost words (Chrome draws them, VeloxPDF does not): ${ok.reduce((a, r) => a + r.lost_count, 0)} in total. Extra overlaps (word boxes that intersect by over 20% in VeloxPDF and not in Chrome): ${ok.reduce((a, r) => a + r.extra_overlaps, 0)} in total.`, '');
  L.push(`| Template | Text | Lost words | Extra overlaps | Layout | Pages (Velox / Chrome) | Score${BASELINE ? ' (before)' : ''} |`, '|---|---|---|---|---|---|---|');
  for (const r of rows) {
    if (r.error) { L.push(`| ${r.name} | | | | | | error: ${r.error} |`); continue; }
    const b = baseOf(r.name);
    const bl = b && !b.error && b.lost_count != null ? ` (${b.lost_count})` : '';
    const bo = b && !b.error && b.extra_overlaps != null ? ` (${b.extra_overlaps})` : '';
    L.push(`| ${r.name} | ${(r.text_coverage * 100).toFixed(0)}% | ${r.lost_count}${bl}${r.lost_count ? ': ' + r.lost_words.slice(0, 6).join(' ') : ''} | ${r.extra_overlaps}${bo}${r.overlap_pairs.length ? ': ' + r.overlap_pairs.slice(0, 2).join('; ') : ''} | ${r.ssim.toFixed(2)} | ${r.velox_pages} / ${r.chrome_pages} | ${(r.score * 100).toFixed(0)}${b && !b.error ? ` (${(b.score * 100).toFixed(0)})` : ''} |`);
  }
  L.push('', 'Reproduce: `CHROME_PATH=... PLAYWRIGHT_CORE_PATH=... node scripts/fidelity/run.mjs --write-results` (needs pdftoppm, pdftotext and python3 with Pillow).', '');
  fs.writeFileSync(path.join(HERE, 'results.md'), L.join('\n'));
}
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(rows, null, 2));
process.exit(0);
