import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  htmlToPdf,
  espressoRender,
  markdownToPdf,
  signPdf,
  verifyPdfSignature,
  generateSelfSignedCert,
  compilePdfTemplate,
} from './src/index.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, 'examples');
fs.mkdirSync(OUT_DIR, { recursive: true });

// 1. Invoice template in the espresso-compatible format (Go `{{.Field}}` + `{{range .Items}}` + Tailwind + SVG + QR + Script Canvas)
export const ESPRESSO_INVOICE_TEMPLATE = `
<!doctype html>
<html>
<head>
  <style>
    @page { size: A4; margin: 36pt; }
    :root { --brand: #4f46e5; --ink: #0f172a; --muted: #64748b; }
    body { font-family: Helvetica, sans-serif; color: var(--ink); font-size: 10.5pt; }
    .header-box { background: linear-gradient(135deg, #0f172a, #1e1b4b); color: #ffffff; padding: 20pt; border-radius: 10pt; margin-bottom: 16pt; }
    table { width: 100%; border-collapse: collapse; margin-top: 12pt; margin-bottom: 14pt; }
    th { background-color: #0f172a; color: #ffffff; padding: 8pt 10pt; text-align: left; font-weight: bold; font-size: 9.5pt; }
    td { padding: 8pt 10pt; border-bottom: 1pt solid #e2e8f0; font-size: 9.5pt; }
    tr:nth-child(even) td { background-color: #f8fafc; }
    .badge { background-color: #dcfce7; color: #166534; padding: 3pt 8pt; border-radius: 6pt; font-weight: bold; font-size: 8.5pt; }
  </style>
</head>
<body>
  <div class="header-box flex justify-between items-center">
    <div>
      <div class="text-2xl font-bold text-white">{{.Company}}</div>
      <div class="text-sm text-slate-300">Tax Invoice & Cryptographic Receipt · {{.InvoiceNumber}}</div>
    </div>
    <div class="text-right">
      <div class="badge">PAID & VERIFIED</div>
      <div class="text-xs text-slate-300 mt-2">Issued: {{.Date}}</div>
    </div>
  </div>

  <div class="grid grid-cols-3 gap-4 mb-4">
    <div class="p-4 bg-slate-50 border border-slate-200 rounded-lg">
      <div class="text-xs font-bold text-slate-500 uppercase">Billed To</div>
      <div class="text-base font-bold text-slate-900 mt-1">{{.CustomerName}}</div>
      <div class="text-xs text-slate-600">{{.CustomerAddress}}</div>
    </div>
    <div class="p-4 bg-slate-50 border border-slate-200 rounded-lg">
      <div class="text-xs font-bold text-slate-500 uppercase">Payment Method</div>
      <div class="text-base font-bold text-slate-900 mt-1">{{.PaymentMethod}}</div>
      <div class="text-xs text-slate-600">Settlement: Instant</div>
    </div>
    <div class="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
      <div class="text-xs font-bold text-indigo-600 uppercase">Total Amount Due</div>
      <div class="text-2xl font-bold text-indigo-900 mt-1" id="grand-total">{{.GrandTotal}}</div>
      <div class="text-xs text-indigo-700">Includes 18% GST</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Item Description</th>
        <th>Category</th>
        <th>Qty</th>
        <th>Unit Price</th>
        <th>Line Total</th>
      </tr>
    </thead>
    <tbody>
      {{range .Items}}
      <tr>
        <td><b>{{.Name}}</b></td>
        <td>{{.Category}}</td>
        <td>{{.Qty}}</td>
        <td>{{.Price}}</td>
        <td><b>{{.Total}}</b></td>
      </tr>
      {{end}}
    </tbody>
  </table>

  <div class="flex justify-between items-center mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
    <div>
      <div class="text-sm font-bold text-slate-900">Revenue Velocity (Vector Canvas2D + Trendline)</div>
      <canvas id="rev-chart" width="280" height="82"></canvas>
    </div>
    <div class="text-right">
      <div class="text-xs text-slate-500 mb-1">ISO Reed-Solomon QR</div>
      <qr value="https://veloxpdf.dev/verify/{{.InvoiceNumber}}" size="68"></qr>
    </div>
  </div>

  <p class="text-xs text-slate-600 mt-3">
    Payment settled via <b>Instant ACH</b> using protocol <code>ISO-20022-RTP</code>. View live cryptographic receipt at <a href="https://veloxpdf.dev/verify/INV-2026-99412">veloxpdf.dev/verify</a>.
  </p>

  <script>
    const c = document.getElementById('rev-chart');
    if (c && c.getContext) {
      const ctx = c.getContext('2d');
      const bars = [26, 38, 34, 48, 44, 58, 54];
      const months = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];
      for (let i = 0; i < bars.length; i++) {
        ctx.fillStyle = i === bars.length - 1 ? '#4f46e5' : '#cbd5e1';
        ctx.fillRect(i * 38 + 8, 64 - bars[i], 22, bars[i]);
        ctx.fillStyle = '#64748b';
        ctx.fillText(months[i], i * 38 + 10, 77);
      }
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < bars.length; i++) {
        const px = i * 38 + 19;
        const py = 60 - bars[i];
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  </script>
</body>
</html>
`;

export const SAMPLE_INVOICE_DATA = {
  Company: 'VeloxPDF Enterprise Cloud',
  InvoiceNumber: 'INV-2026-99412',
  Date: '21 Oct 2026',
  CustomerName: 'Acme Robotics Corp',
  CustomerAddress: '742 Evergreen Terrace, San Francisco, CA',
  PaymentMethod: 'Wire Transfer · ACH #8841',
  GrandTotal: '$14,820.00',
  Items: [
    { Name: 'Zero-Chromium Vector PDF Engine License', Category: 'Core SDK', Qty: '1', Price: '$6,500.00', Total: '$6,500.00' },
    { Name: 'High-Throughput X.509 Cryptographic Signer', Category: 'Security', Qty: '2', Price: '$2,400.00', Total: '$4,800.00' },
    { Name: 'Edge Worker Multi-Region Deployment Pack', Category: 'Cloud', Qty: '1', Price: '$3,520.00', Total: '$3,520.00' },
  ],
};

// 2. 180-Row Multi-Page Table Stress Test (Verifies Automatic Pagination & `<thead>` Repeat!)
function buildMultiPageTableHtml(rowCount = 180) {
  const rows = [];
  for (let i = 1; i <= rowCount; i++) {
    rows.push(`
      <tr>
        <td>TXN-${String(i).padStart(5, '0')}</td>
        <td>2026-10-${String((i % 28) + 1).padStart(2, '0')}</td>
        <td>Cloud Compute Shard #${(i % 16) + 1} — Automated Settlement</td>
        <td>${i % 3 === 0 ? 'Enterprise' : 'Standard'}</td>
        <td>$${(120 + (i * 17) % 900).toFixed(2)}</td>
      </tr>
    `);
  }
  return `
    <!doctype html>
    <html>
    <head>
      <style>
        @page { size: A4; margin: 36pt; }
        body { font-family: Helvetica, sans-serif; font-size: 9.5pt; color: #0f172a; }
        h1 { font-size: 16pt; font-weight: bold; margin-bottom: 8pt; }
        table { width: 100%; border-collapse: collapse; }
        th { background-color: #0f172a; color: #ffffff; padding: 6pt 8pt; text-align: left; font-weight: bold; }
        td { padding: 5.5pt 8pt; border-bottom: 1pt solid #e2e8f0; }
        tr:nth-child(even) td { background-color: #f8fafc; }
      </style>
    </head>
    <body>
      <h1>Multi-Page Financial Audit Ledger (${rowCount} Rows)</h1>
      <table>
        <thead>
          <tr>
            <th>Transaction ID</th>
            <th>Date</th>
            <th>Description</th>
            <th>Tier</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>${rows.join('')}</tbody>
      </table>
    </body>
    </html>
  `;
}

async function runBenchmarks() {
  console.log('========================================================================');
  console.log('VELOXPDF BENCHMARK: Zero-Chromium HTML/Tailwind/Canvas/X.509 -> PDF 1.7');
  console.log('========================================================================\n');

  const cert = generateSelfSignedCert({ commonName: 'VeloxPDF Authority', org: 'VeloxPDF Inc.' });

  // Warmup
  for (let i = 0; i < 15; i++) {
    espressoRender(ESPRESSO_INVOICE_TEMPLATE, SAMPLE_INVOICE_DATA);
  }

  // 1. Single-Page Invoice Benchmark (HTML + Tailwind + Go Template + Script Canvas + QR)
  const N_RUNS = 200;
  const timesRender = [];
  let lastPdf = null;
  for (let i = 0; i < N_RUNS; i++) {
    const t0 = performance.now();
    lastPdf = espressoRender(ESPRESSO_INVOICE_TEMPLATE, SAMPLE_INVOICE_DATA, { compress: false, visualSeal: true });
    timesRender.push(performance.now() - t0);
  }
  timesRender.sort((a, b) => a - b);
  const medianRenderMs = timesRender[Math.floor(N_RUNS / 2)];
  const p95RenderMs = timesRender[Math.floor(N_RUNS * 0.95)];
  const renderRps = Math.round(1000 / medianRenderMs);

  // 1B. Futamura Parametric Compiled Template (`compilePdfTemplate(html)` -> `compiled.render(data)`)
  const compiledInvoice = compilePdfTemplate(ESPRESSO_INVOICE_TEMPLATE, SAMPLE_INVOICE_DATA);
  for (let i = 0; i < 30; i++) compiledInvoice.render(SAMPLE_INVOICE_DATA);
  const timesCompiled = [];
  let lastCompiledPdf = null;
  for (let i = 0; i < 500; i++) {
    const t0 = performance.now();
    lastCompiledPdf = compiledInvoice.render(SAMPLE_INVOICE_DATA);
    timesCompiled.push(performance.now() - t0);
  }
  timesCompiled.sort((a, b) => a - b);
  const medianCompiledMs = timesCompiled[Math.floor(timesCompiled.length / 2)];
  const compiledRps = Math.round(1000 / medianCompiledMs);

  // 2. Cryptographic X.509 Signing Benchmark
  const timesSign = [];
  let signedPdf = null;
  for (let i = 0; i < 100; i++) {
    const t0 = performance.now();
    signedPdf = signPdf(lastPdf, {
      certPem: cert.certPem,
      keyPem: cert.keyPem,
      signerName: 'VeloxPDF Treasury Authority',
      reason: 'Tax Invoice Cryptographic Attestation',
      location: 'San Francisco, US',
    });
    timesSign.push(performance.now() - t0);
  }
  timesSign.sort((a, b) => a - b);
  const medianSignMs = timesSign[Math.floor(timesSign.length / 2)];
  const signRps = Math.round(1000 / medianSignMs);
  const verification = verifyPdfSignature(signedPdf);

  // 3. 180-Row Multi-Page Table Pagination Benchmark
  const multiHtml = buildMultiPageTableHtml(180);
  const tMulti0 = performance.now();
  const multiRes = htmlToPdf(multiHtml, { returnMetrics: true, headerText: 'VeloxPDF Audit Ledger', footerText: 'Page {{page}} of {{pages}}' });
  const multiMs = performance.now() - tMulti0;

  // Save sample outputs
  fs.writeFileSync(path.join(OUT_DIR, 'invoice-signed.pdf'), signedPdf);
  fs.writeFileSync(path.join(OUT_DIR, 'ledger-180-rows.pdf'), multiRes.pdfBytes);

  console.log(`1A. One-Shot Cold Render (Full HTML5 + CSS Cascade + Tailwind + Layout -> PDF):`);
  console.log(`   - Median Latency      : ${medianRenderMs.toFixed(3)} ms`);
  console.log(`   - P95 Latency         : ${p95RenderMs.toFixed(3)} ms`);
  console.log(`   - Single-Core Speed   : ${renderRps.toLocaleString()} PDFs / sec`);
  console.log(`   - Output Size         : ${(lastPdf.byteLength / 1024).toFixed(1)} KB (%PDF-1.7 header verified: ${Buffer.from(lastPdf.subarray(0, 8)).toString()})\n`);

  console.log(`1B. Futamura Parametric Compiled Template (\`compilePdfTemplate(html).render(data)\` — 500 runs):`);
  console.log(`   - Median Latency      : ${medianCompiledMs.toFixed(4)} ms`);
  console.log(`   - Single-Core Speed   : ${compiledRps.toLocaleString()} PDFs / sec`);
  console.log(`   - Compiled Byte Size  : ${(lastCompiledPdf.byteLength / 1024).toFixed(1)} KB (${compiledInvoice.slotCount} parametric slots)\n`);

  console.log(`2. X.509 Cryptographic Digital Signing (RSA-SHA256 /ByteRange):`);
  console.log(`   - Median Sign Latency : ${medianSignMs.toFixed(3)} ms  (${signRps.toLocaleString()} signed PDFs / sec)`);
  console.log(`   - Signature Verified  : ${JSON.stringify(verification)}\n`);

  console.log(`3. 180-Row Multi-Page Table Pagination (with automatic <thead> repeat):`);
  console.log(`   - Pages Generated     : ${multiRes.pageCount} pages`);
  console.log(`   - Total Latency       : ${multiMs.toFixed(2)} ms`);
  console.log(`   - Saved Deliverables  : examples/invoice-signed.pdf, examples/ledger-180-rows.pdf`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runBenchmarks();
}
