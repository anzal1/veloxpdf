# VeloxPDF

> **Turn HTML, CSS and Tailwind templates into signed vector PDFs, and invoice data into compliant e-invoices, in plain JavaScript. No browser, zero dependencies.**
>
> 8x faster than warm headless Chrome and 50x faster than a cold launch on the same invoice (2.3 ms vs 18 ms vs 116 ms, measured with `scripts/compare-chrome.mjs`). Runs in Node.js, Bun, Cloudflare Workers and the browser.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-success.svg)](package.json)
[![PDF/A-3b](https://img.shields.io/badge/PDF%2FA--3b-veraPDF%20pass-indigo.svg)](#e-invoices-in-one-call)
[![Factur-X / ZUGFeRD / XRechnung](https://img.shields.io/badge/EN%2016931-Factur--X%20%C2%B7%20ZUGFeRD%20%C2%B7%20XRechnung-emerald.svg)](#e-invoices-in-one-call)

**[Try the Studio in your browser](https://anzal1.github.io/veloxpdf/)**: edit an invoice and watch the PDF and the embedded XML update. Everything runs in your tab; nothing is uploaded.

```bash
npm install github:anzal1/veloxpdf
```

---

## E-invoices in one call

France requires e-invoices from large and mid-size companies from September 2026 (SMEs from 2027), and Germany from 2027 (all businesses from 2028). Both accept a hybrid PDF that people can read with the structured invoice data embedded inside it: Factur-X in France, ZUGFeRD in Germany, plus XRechnung for German public-sector buyers.

VeloxPDF builds that file from one plain invoice object:

```js
import { renderEInvoice } from 'veloxpdf';
import fs from 'node:fs';

const pdf = renderEInvoice({
  number: 'RE-2026-0042',
  issueDate: '2026-10-20',
  currency: 'EUR',
  seller: { name: 'Lieferant Technik GmbH', vatId: 'DE123456789', address: { line1: 'Lindenstraße 12', city: 'Berlin', postcode: '10115', country: 'DE' } },
  buyer:  { name: 'Kunde & Partner AG', vatId: 'DE987654321', address: { line1: 'Hafenweg 3', city: 'Hamburg', postcode: '20457', country: 'DE' } },
  lines: [
    { name: 'Beratung Systemintegration', quantity: 12.5, unitCode: 'HUR', netPrice: '95.00', vatCategory: 'S', vatRate: 19 },
  ],
  paymentTerms: { dueDate: '2026-11-19' },
  paymentMeans: { code: '58', iban: 'DE89 3704 0044 0532 0130 00' },
}, { profile: 'EN16931' });

fs.writeFileSync('invoice.pdf', pdf); // PDF/A-3b with factur-x.xml embedded
console.log(pdf.totals.grandTotal);   // the same totals are printed on the page and written to the XML
```

- **Profiles:** MINIMUM, BASIC WL, BASIC, EN 16931 and XRechnung, following EN 16931.
- **Checked by the official tools:** every bundled example passes [veraPDF](https://verapdf.org) (PDF/A-3b) and the [Mustang](https://www.mustangproject.org) Factur-X/ZUGFeRD validator, unsigned and signed.
- **One set of numbers:** totals and the VAT breakdown are computed once with exact decimal arithmetic (EN 16931 rounding), then used for both the visible invoice and the XML, so they cannot disagree.
- **Readable errors:** a missing field comes back as `BT-31 Seller VAT identifier is required for standard-rated invoices`, not a validator dump.
- **Your design or ours:** a clean default template is built in; pass `template` to use your own HTML with the same data.
- **About 8 ms per invoice** (median of 20 runs for the German example, 43 KB with embedded fonts). Sign it in the same call with `sign: true`.

Lower-level pieces are exported too: `computeTotals`, `validateInvoice`, `buildCiiXml` and the `EINVOICE_EXAMPLES` fixtures. Any template can also be rendered as PDF/A-3b with `htmlToPdf(html, { pdfa: '3b' })`.

## Any HTML template to PDF

```js
import { htmlToPdf, signPdf } from 'veloxpdf';

const pdf = htmlToPdf('<h1 class="text-2xl font-bold">Hello {{.Name}}</h1>', { data: { Name: 'Ada' } });
const signed = signPdf(pdf); // X.509 / PKCS#7 signature, verifiable in any PDF reader
```

Tailwind classes, CSS grid and flexbox, tables that paginate with repeated headers, SVG, `<canvas>` charts, QR codes and Code 128 barcodes are drawn as vectors. See the API section below.

## Real-world fidelity

VeloxPDF is checked against Chrome on 15 open-source invoice and receipt templates (`scripts/fidelity/`): it draws 99% of the words Chrome draws, matches Chrome's page count on 13 of 15 templates, and scores 85.9 out of 100 overall (text, layout similarity and page count combined). The scoring script and every template are in the repo, so you can check the numbers or add a template that breaks it. Full per-template results are in [`scripts/fidelity/results.md`](scripts/fidelity/results.md).

## For AI agents (MCP)

`veloxpdf-mcp` is a zero-dependency [Model Context Protocol](https://modelcontextprotocol.io) server with `render_pdf`, `sign_pdf`, `verify_pdf` and `extract_pdf_data` tools, so an agent can turn the HTML it writes into a signed PDF without a browser:

```json
{ "mcpServers": { "veloxpdf": { "command": "npx", "args": ["-y", "-p", "github:anzal1/veloxpdf", "veloxpdf-mcp"] } } }
```

It only reads and writes files inside its working directory unless you allow otherwise.

---

## The Engineering Problem: Rendering Invoices Through a Browser

Teams that generate invoices, compliance reports, tickets or audit ledgers at volume usually end up running headless Chrome next to their app:

- **Memory:** a headless Chrome process tree held about 290 MB resident (summed RSS) with one page open, measured on the machine below.
- **Latency:** a cold launch plus one invoice took about 116 ms, and a warm browser with a reused page about 18 ms, measured with `scripts/compare-chrome.mjs`.
- **Serverless:** a browser needs its own process or service, which Cloudflare Workers cannot host. VeloxPDF is plain JavaScript and runs there.
- **Operations:** a browser is one more long-lived process to supervise, restart and patch.

**VeloxPDF takes the browser out of the path.**  
It is a zero-dependency compiler that parses HTML5, resolves Tailwind CSS classes, computes box models, runs author-supplied `<script>` Canvas2D chart routines in a `node:vm` context (for trusted templates; not a sandbox for untrusted input), paginates multi-page tables, and writes vector PDF 1.7 with X.509 PKCS#7 signatures and an embedded JSON copy of your data. A one-page invoice renders in about 2 ms, and a precompiled template in about 0.013 ms.

---

## Performance Benchmarks

Every number here was measured on one machine: Apple M5 Max (`darwin/arm64`), Node.js v24.20.0, one core, headless Chrome 153. Reproduce them with `node scripts/compare-chrome.mjs` (needs `playwright-core` for the Chrome rows; add `--velox-only` to skip them), `veloxpdf bench` and `node benchmark.mjs`.

### Same invoice, VeloxPDF vs headless Chrome

A plain-CSS invoice (`scripts/fixtures/plain-invoice.html`, three line items, A4, one page), the same final HTML on both sides, PDF bytes produced in memory. Median of 30 to 50 runs (7 for Chrome cold).

| Path | p50 | p95 | PDFs/sec (sequential) | Speedup vs warm Chrome |
| :--- | :--- | :--- | :--- | :--- |
| Headless Chrome, cold (launch + render) | 116 ms | 136 ms | 9 | n/a |
| Headless Chrome, warm (browser and page reused) | 18.4 ms | 19.3 ms | 54 | 1x |
| **VeloxPDF `htmlToPdf`** | **2.3 ms** | **3.0 ms** | **444** | **8x** |
| **VeloxPDF `compilePdfTemplate`** | **0.013 ms** | **0.022 ms** | **79,000** | **1,400x** |

The first VeloxPDF render in a fresh process takes about 3.7 ms. VeloxPDF uses the standard PDF fonts by default, so this file is 9.8 KB against Chrome's 56 KB with embedded fonts; embed a `.ttf` when you need exact glyphs.

### The full invoice preset, VeloxPDF only

The Tailwind invoice preset from `server.mjs` (Tailwind grid, Canvas2D chart, QR code, Code 128 barcode). Chrome needs Tailwind's CSS to render it, so it is not in the table above.

| Operation | p50 | p95 | Per second (one core) |
| :--- | :--- | :--- | :--- |
| `htmlToPdf` warm | 2.1 ms | 4.2 ms | ~470 |
| `compilePdfTemplate` render, same row count | 0.014 ms | 0.021 ms | ~70,000 |
| `signPdf` (RSA-SHA256, PKCS#7) | 0.6 ms | 1.0 ms | ~1,700 |
| `verifyPdfSignature` | 0.07 ms | 0.09 ms | ~14,000 |
| `extractEmbeddedData` | 0.007 ms | 0.011 ms | ~150,000 |
| 100 different customers through one compiled template | 1.0 ms total | 1.9 ms | ~10 µs per document |

A compiled template takes the fast path when the number of repeated rows matches the sample it was compiled with. When the row count changes, the document is laid out in full, which costs about the same as `htmlToPdf`: about 12 ms for 45 rows and about 48 ms for 200 rows.

VeloxPDF's JS heap grew by about 1 MB over 250 renders (after garbage collection). Timings include no network and no disk.

---

## Architectural Deep Dive

VeloxPDF is engineered as a clean 5-stage compiling pipeline:

```
[ HTML5 / Tailwind / Templates / JSON Data ]
                     │
                     ▼
   Stage 1: DOM-VM & Script Context  ─────── Parses tags, compiles Go `{{.Field}}` / `{{range}}`,
                     │                         executes author `<script>` Canvas2D drawing commands
                     │                         with a 50ms timeout (trusted templates only; not a sandbox).
                     ▼
   Stage 2: CSS & Tailwind Engine ─────────── Resolves cascades, CSS variables (`var(--brand)`), `calc()`,
                     │                         `@media print`, `position: absolute/relative`, `z-index`,
                     │                         `opacity`, `float: left/right`, `flex-wrap: wrap`.
                     ▼
   Stage 3: Layout & Pagination ────────────── Computes box models, Hirschberg–Larmore Monge-Matrix $O(n)$
                     │                         paragraph breaking, 2D table `rowspan`+`colspan` occupancy matrix,
                     │                         nested `<table>` cells, `<tfoot>`, and running footers.
                     ▼
   Stage 4: Native PDF 1.7 Writer ──────────── Emits vector graphics operators (`m`, `l`, `c`, `re`),
                     │                         binary TrueType (`.ttf`) `/Type0` `/Identity-H` font subsets with
                     │                         `/ToUnicode` CMaps, Reed-Solomon QR, Code 128 barcodes,
                     │                         and an `/EmbeddedFiles` JSON attachment.
                     ▼
   Stage 5: X.509 PKCS#7 Enclave ──────────── Injects ISO 32000-1 `/Type /Sig` dictionary, computes exact
                     │                         `/ByteRange` SHA-256 digest, embeds CMS DER signature
                     │                         (synchronous and WebCrypto `crypto.subtle` async).
                     ▼
            [ Signed Vector PDF ]
```

---

### Core Techniques

#### 1. Hirschberg–Larmore Monge-Matrix Least-Weight Subsequence Line Breaking
Standard Knuth-Plass line breaking algorithms run in $O(n^2)$ time. VeloxPDF implements the **Hirschberg–Larmore (1987, SIAM J. Comput. `DOI 10.1137/0216043`) Least-Weight Subsequence** algorithm:
- Uses prefix-sum word widths to evaluate any candidate line width in $O(1)$ time.
- Leverages the **Quadrangle Inequality** on the line-slack demerit function $w(i, j) = (\text{availW} - \text{width}(i, j))^3$, proving that the weight matrix is a Monge matrix.
- Maintains a monotone candidate deque with bridge-point binary searches to find optimal line breakpoints in $O(n \log n)$ worst-case and $O(n)$ average time.
- Picks line breaks that minimise raggedness across the whole paragraph, and never leaves a space before punctuation.

#### 2. Embedded JSON Data (`/EmbeddedFiles` `velox-payload.json`)
Every document VeloxPDF renders from data carries a copy of that data:
- **Visual copy:** a standard ISO 32000-1 vector PDF with typography, Canvas2D charts, barcodes and an optional visual seal.
- **Data copy:** the JSON you passed in is compressed and embedded as an `/EmbeddedFile` attachment (`velox-payload.json`), registered under `/Names << /EmbeddedFiles ... >>` and `/AF`.
- **Signed with the page:** the attachment stream sits inside the `/ByteRange` covered by the X.509 signature, so changing the JSON breaks the signature.
- **Read back without OCR:** `extractEmbeddedData(pdfBytes)` returns the exact JSON in about 0.007 ms (measured, see Performance Benchmarks), with no text extraction or OCR step.

The attachment is a plain JSON file. It is not a PDF/A-3 Factur-X or ZUGFeRD package, and VeloxPDF does not claim those e-invoicing profiles.

#### 3. Elastic Futamura Parametric Compilation
`compilePdfTemplate(html, sampleData, options)` applies **Futamura's 2nd Projection** to turn a template into a fast renderer:
- **Fixed-topology fast path (about 0.013 ms, ~79,000 PDFs/sec):** when the template's layout is fixed, VeloxPDF pre-computes geometry, CSS cascades and font metrics into an immutable instruction tape, and rendering is scalar substitution. This holds while repeated rows (`{{range .Items}}`) keep the row count of the sample data.
- **Changing row counts:** a document whose row count differs from the sample is laid out in full and paginated, including repeated `<thead>` headers and `Page {{page}} of {{pages}}` footers. Measured: about 12 ms for 45 rows and about 48 ms for 200 rows, about the same as `htmlToPdf`.

#### 4. Binary TrueType (`.ttf`) Parser & `/Type0` Unicode Embedding
VeloxPDF includes a zero-dependency binary TrueType font parser (`parseTrueTypeFont`) that reads raw `.ttf` byte buffers directly:
- Parses binary font tables: `head`, `hhea`, `maxp`, `hmtx`, `cmap` (format 4 and 12), `name`, `OS/2`, and `post`.
- Emits composite `/Type /Font /Subtype /Type0 /Encoding /Identity-H` font dictionaries with `/CIDFontType2` descendants and Flate-compressed `/FontFile2` byte streams.
- Synthesizes bidirectional `/ToUnicode` CMaps mapping character codes back to UTF-16BE hex strings (`<GGGG>`).
- Built-in WinAnsi symbol mapping supports universal currency symbols (`$`, `€`, `£`, `₹`, `¥`) and typography glyphs (em dash, en dash, `•`, `…`, `©`, `®`, `™`, `°`, `±`, `×`, `÷`, `✓`, `→`) even when no custom font file is supplied.

#### 5. Virtual DOM Script Execution (trusted templates only)
Inline `<script>` tags execute inside a `node:vm` context so author templates can draw Canvas2D charts:
- Enforces a **50ms execution timeout** (`timeout: 50`) on synchronous script execution, which stops simple infinite loops.
- Nulls the common globals (`Function`, `eval`, `process`, `require`, `globalThis.constructor`) inside the context.
- Provides concurrency-isolated `<canvas>` 2D recording for procedural charts, sparklines, and vector graphics.

> **Security warning: this is NOT a sandbox for untrusted input.** `node:vm` is not a security
> boundary (see the Node.js docs). Host objects passed into the context (`document`, `console`,
> the canvas context, even the `data` object) expose the parent-realm `Function` constructor via
> `someHostObject.constructor.constructor`, which reaches the real `process` and full host access.
> Only render HTML you control with scripts enabled. Pass `runScripts: false` for any untrusted
> HTML, and never expose the Studio server to an untrusted network (it binds to `127.0.0.1` by default).

#### 6. Universal WebCrypto Async Enclave
In addition to Node.js synchronous crypto (`signPdf`, `verifyPdfSignature`), VeloxPDF provides a 100% standards-compliant WebCrypto engine (`renderPdfAsync`, `signPdfAsync`, `verifyPdfSignatureAsync`) powered by `crypto.subtle`:
- Runs natively on Cloudflare Workers (`nodejs_compat`), Deno, Bun, Node.js, and modern browser runtimes.
- Computes SHA-256 digests and RSA/ECDSA signatures asynchronously without blocking the event loop.


#### 7. W3C CSS Specificity Precedence & Deterministic Cascade Sorting
`computeSelectorSpecificity(selector)` scores selectors using W3C Selectors Level 3 arithmetic:
$$\text{Specificity} = (\text{IDs} \times 1{,}000{,}000) + (\text{Classes, Attributes \& Pseudo-classes} \times 1{,}000) + \text{Tags}$$
- Rules are pre-sorted by `(specificity ASC, ruleIndex ASC)` before applying declarations to elements.
- Guarantees `#hero-id` (`#16a34a`) strictly beats `.card-class` (`#2563eb`) which strictly beats `div` (`#dc2626`) regardless of the order rules are declared in `<style>` blocks.
- Tailwind utility classes and inline `style="..."` attributes take ultimate precedence over stylesheet rules, with `!important` flags strictly preserved across the cascade.

#### 8. Self-Contained Client-Side Standalone Browser Bundle (`veloxpdf.browser.js`)
Compiling via `npm run build:browser` (`scripts/build-browser.mjs`) generates a zero-backend, standalone browser ESM file (`public/veloxpdf.browser.js`):
- Contains lightweight zero-dependency shims for `Buffer` (subclassing `Uint8Array`), RFC 1950 DEFLATE/INFLATE, a script context for trusted template scripts, and pure WebCrypto SHA-256 / RSA verification.
- Runs 100% inside modern web browsers, Cloudflare Workers, and Edge environments with zero server dependencies.
- Exposes `window.VeloxPDF` for instant browser-native PDF generation, digital signing, embedded JSON recovery, and 100-document batch mail-merges.

#### 9. 100-Document Batch Mail-Merge (`POST /api/batch` & `compilePdfTemplate`)
One compiled template renders 100 different customer invoices in about 1.0 ms total (about 10 µs per document, one core, measured with `scripts/compare-chrome.mjs`). Each output is a distinct PDF. The Studio UI includes a 100-document flipbook scrubber and a one-click batch ledger CSV exporter.

#### 10. Drag-and-Drop `.pdf` Signature Verifier & JSON Extractor
Drag any `.pdf` onto the Studio window, or upload it via `POST /api/inspect-pdf`. The engine checks the X.509 PKCS#7 signature (about 0.07 ms) and reads the embedded `velox-payload.json` into structured data and an exportable CSV table, with no OCR.

---
## CLI Installation & Usage

VeloxPDF ships with a command-line interface:

```bash
# Clone and link locally
cd veloxpdf
npm link

# 1. Compile HTML to Signed Vector PDF
veloxpdf render invoice.html -o invoice.pdf --data data.json --sign

# 2. Add Running Headers & Footers across Multi-Page Tables
veloxpdf render ledger.html -o ledger.pdf \
  --header "CONFIDENTIAL AUDIT LEDGER" \
  --footer "Page {{page}} of {{pages}}"

# 3. Embed Custom TrueType Font
veloxpdf render document.html -o document.pdf --ttf Inter-Regular.ttf

# 4. Cryptographically Verify X.509 Signatures
veloxpdf verify invoice.pdf

# 5. Extract the embedded JSON payload (no OCR)
veloxpdf extract invoice.pdf -o payload.json

# 6. Run Live Performance Benchmarks
veloxpdf bench --n 200

# 7. Launch VeloxPDF Studio Web UI
veloxpdf serve --port 8585

# 8. Build Standalone Client-Side Browser Bundle
npm run build:browser
```

---
## JavaScript / TypeScript API

### 1. Basic HTML to Vector PDF
```javascript
import { htmlToPdf } from 'veloxpdf';
import fs from 'node:fs';

const html = `
  <!doctype html>
  <html>
    <head>
      <style>
        body { font-family: Helvetica; color: #0f172a; padding: 24pt; }
        .badge { background: #dcfce7; color: #166534; padding: 4pt 8pt; border-radius: 4pt; }
      </style>
    </head>
    <body>
      <h1 class="text-2xl font-bold text-indigo-600">Settlement Complete</h1>
      <div class="badge">VERIFIED BY VELOX</div>
      <p class="mt-4">Payment settled using protocol <code>ISO-20022-RTP</code>.</p>
      <qr value="https://veloxpdf.dev/receipt/99412" size="64"></qr>
    </body>
  </html>
`;

const { pdfBytes, pageCount } = htmlToPdf(html, {
  format: 'A4',
  compress: true,
});

fs.writeFileSync('output.pdf', Buffer.from(pdfBytes));
```

### 2. Go-Style Templates, Embedded JSON & X.509 Digital Signatures
```javascript
import { espressoRender, signPdf, verifyPdfSignature, extractEmbeddedData, generateSelfSignedCert } from 'veloxpdf';

const template = `
  <div class="p-6">
    <h2 class="text-xl font-bold">{{.Company}}</h2>
    <p>Customer: {{.CustomerName}}</p>
    <table>
      <thead><tr><th>Item</th><th class="text-right">Total</th></tr></thead>
      <tbody>
        {{range .Items}}
        <tr><td>{{.Name}}</td><td class="text-right">{{.Price}}</td></tr>
        {{end}}
      </tbody>
    </table>
  </div>
`;

const data = {
  Company: 'Acme Cloud Shards',
  CustomerName: 'Vanguard Global',
  Items: [
    { Name: 'Shard Compute Lease', Price: '$4,200.00' },
    { Name: 'Hardware HSM Attestation', Price: '$1,800.00' },
  ],
};

// 1. Render the PDF with the data embedded as JSON
const { pdfBytes } = espressoRender(template, data);

// 2. Cryptographically Sign with X.509 Certificate
const cert = generateSelfSignedCert({ commonName: 'Velox Security Authority' });
const signedPdf = signPdf(pdfBytes, {
  certPem: cert.certPem,
  keyPem: cert.keyPem,
  signerName: 'Velox Security Authority',
  reason: 'Automated Financial Attestation',
});

// 3. Cryptographically Verify Signature
const verification = verifyPdfSignature(signedPdf);
console.log('Signature valid:', verification.valid); // true
console.log('ByteRange:', verification.byteRange);   // [0, 14210, 15490, 120]

// 4. Read the embedded JSON back (about 0.007 ms, no OCR)
const extractedPayload = extractEmbeddedData(signedPdf);
console.log('Recovered Customer:', extractedPayload.CustomerName); // "Vanguard Global"
```

### 3. Futamura Parametric Compilation (about 79,000 pages/sec)
```javascript
import { compilePdfTemplate } from 'veloxpdf';

// Compile template once at startup (pre-computes layout & bytecode tape)
const renderInvoice = compilePdfTemplate(invoiceTemplateHtml, sampleData);

// Render loop: about 0.013 ms per document while the row count matches the sample
for (const invoice of incomingInvoices) {
  const { pdfBytes } = renderInvoice(invoice);
  await cloudStorage.upload(invoice.id, pdfBytes);
}
```

### 4. Edge WebCrypto Async API
```javascript
import { renderPdfAsync, signPdfAsync, verifyPdfSignatureAsync } from 'veloxpdf';

// Edge-compatible rendering & signing on Cloudflare Workers / Deno
const { pdfBytes } = await renderPdfAsync(html, { data });
const signedPdf = await signPdfAsync(pdfBytes, { certPem, keyPem });
const verification = await verifyPdfSignatureAsync(signedPdf);
```

### 5. Custom TrueType (.ttf) Font Embedding
```javascript
import { htmlToPdf } from 'veloxpdf';
import fs from 'node:fs';

const interTtf = fs.readFileSync('fonts/Inter-Regular.ttf');

const { pdfBytes } = htmlToPdf(html, {
  fonts: {
    'Inter': interTtf,
  },
});
```

### 6. 100-Document Batch Mail-Merge via `compilePdfTemplate`
```javascript
import { compilePdfTemplate } from 'veloxpdf';

// 1. Pre-compile template once (topology, CSS cascades, and geometry are frozen)
const template = `
  <div class="p-8">
    <h1 class="text-2xl font-bold">INVOICE {{.InvoiceNumber}}</h1>
    <p>Customer: <b>{{.CustomerName}}</b></p>
    <p>Account ID: {{.AccountId}}</p>
    <div class="text-lg font-bold text-indigo-600 mt-4">Total: {{.GrandTotal}}</div>
  </div>
`;
const renderInvoice = compilePdfTemplate(template, sampleData);

// 2. Generate 100 customer PDFs in about 1 ms total (about 10 µs per document)
const customerPdfs = customers.map((cust) => renderInvoice(cust));
console.log(`Generated ${customerPdfs.length} PDFs`);
```

### 7. Client-Side Browser Bundle (`veloxpdf.browser.js`)
```html
<script type="module" src="/veloxpdf.browser.js"></script>
<script>
  // Runs 100% in browser with zero server round-trips!
  const { htmlToPdf, compilePdfTemplate, extractEmbeddedData } = window.VeloxPDF;
  const { pdfBytes } = htmlToPdf('<h1>Client-Side Vector PDF</h1>');
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  window.open(url);
</script>
```

### 8. HTTP REST Endpoints (`POST /api/batch` & `POST /api/inspect-pdf`)
```bash
# Batch mail-merge 100 customized invoices in about 1 ms
curl -X POST http://localhost:8585/api/batch \
  -H "Content-Type: application/json" \
  -d '{"html": "<h1>Invoice {{.InvoiceNumber}}</h1>", "count": 100}'

# Signature verifier and embedded JSON extractor
curl -X POST http://localhost:8585/api/inspect-pdf \
  -H "Content-Type: application/json" \
  -d '{"pdfBase64": "...", "fileName": "invoice.pdf"}'
```

---

## VeloxPDF Studio UI

VeloxPDF includes a high-performance developer studio web UI featuring:
- **⚡ 100-PDF Batch Interactive Mail-Merge Flipbook Modal (`#batch-modal` + Topbar Button):**
  - Compiles 100 distinct customer invoices in about 1 ms (about 10 µs per PDF).
  - Interactive **Invoice Scrubber Slider** (`Invoice #1 of 100`, with customer, invoice number and total) to preview any invoice live on the canvas, download individual customer PDFs, or export the complete 100-customer batch ledger as CSV.
- **Drag-and-Drop `.pdf` Signature Verifier & JSON/CSV Extractor:**
  - Drag and drop **any `.pdf` file** anywhere onto the Studio window (with full-window drag overlay) or select via modal file pickers.
  - X.509 signature verification (about 0.07 ms) displaying `VERIFIED` vs `TAMPER DETECTED` / `UNSIGNED`.
  - OCR-free extraction of the embedded `velox-payload.json` line items with a 1-click **`⬇ Export Line Items as CSV (Excel)`** button.
- **1-Click Brand Logo Uploader:**
  - In the Visual Form Editor, upload any PNG/JPEG/SVG logo or choose from preset brand crests to inject custom branding into the template header live.
- **Client-Side Standalone Browser Engine (`/veloxpdf.browser.js`):**
  - Loads asynchronously in the browser so `window.VeloxPDF` is available in the browser console and acts as an instant zero-backend fallback if hosted statically on GitHub Pages / Vercel.
- **Zero-Flicker High-DPI Vector Canvas Preview:** Powered by PDF.js with automatic high-fidelity fallback.
- **6 Production Presets:**
  1. *Tax Invoice & Signed Receipt* (Canvas2D revenue chart + SVG logo + QR code + X.509 signature)
  2. *Multi-Page Financial Audit Ledger* (Repeating `<thead>`, running headers/footers, numeric alignment)
  3. *Flight Boarding Pass & Logistics Label* (ISO Code 128 barcode + gate QR + landscape ticket layout)
  4. *Security Audit & Compliance Certificate* (Landscape security frame + SVG security crest + cryptographic seal)
  5. *SaaS Usage & Telemetry Report* (Multi-metric Tailwind grid + Canvas2D trend lines)
  6. *Extreme Stress-Test: Rowspan + Watermark + Bezier Canvas + Barcode/QR* (2D table matrix with both `rowspan="2"` and `colspan="2"`, rotated diagonal watermark, `calc(100% - 20pt)` layout box, multi-series bezier Canvas2D with `setLineDash([4, 3])`, ISO Code 128 barcode, 150+ byte QR code, multi-currency `$`, `€`, `£`, `₹`, `¥`, and X.509 digital signature)
- **Interactive 1-Byte Tamper Test:** Mutates a single bit in the signed PDF and demonstrates the signature check rejecting it.
- **Live Benchmark Modal:** Runs the warm-render and compiled-template benchmark from the Studio.
- **Embedded JSON Inspector:** Extracts the embedded `velox-payload.json` stream from inside the signed `/ByteRange`, with no OCR.

To launch the studio:
```bash
npm run studio
# Or: veloxpdf serve --port 8585
```
Open [http://localhost:8585](http://localhost:8585) in any modern browser.
---

## Supported Features vs. Honest Scope

VeloxPDF is purpose-built for **high-throughput, pixel-precise transactional and operational documents** (invoices, receipts, financial ledgers, boarding passes, certificates, telemetry reports, shipping labels, contracts).

### What Is Supported
- [x] **Structured HTML5 & CSS Box Model:** Block flow, inline flow, padding, margins, borders, per-corner `border-radius`, `linear-gradient`, 1D `flex` rows (`justify-between`, icon+title alignment), `flex-wrap: wrap`, 2D `grid-template-columns` (`fr`, `%`, `px`), `float: left` / `float: right`, `position: absolute` / `position: relative`, `z-index` layer stacking, and `opacity`.
- [x] **Watermarks & Rotated Transforms:** `transform: rotate(...)` diagonal watermarks (e.g. `rotate(-35deg)`), `scale(...)`, and `translateX/Y`.
- [x] **Mathematical `calc()` Expressions & `@media print`:** Dynamic dimensional arithmetic (`calc(100% - 20pt)`, `calc(50% - 12px)`) resolved against container widths, and `@media print` stylesheets unwrapped and applied automatically.
- [x] **Tailwind CSS Engine:** Color palettes (`slate`, `indigo`, `emerald`, `amber`, etc.), layout, typography, borders, positioning (`absolute`, `relative`, `top-*`, `left-*`), rotation (`rotate-*`), and opacity (`opacity-*`).
- [x] **Virtual Canvas2D Vector Execution:** `<canvas>` scripts (`fillRect`, `beginPath`, `moveTo`, `lineTo`, `bezierCurveTo`, `quadraticCurveTo`, `setLineDash`, `fillText`) compiled directly into resolution-independent PDF vector paths.
- [x] **SVG Vector Shapes & Paths:** `<svg>` with `<path d="M/L/H/V/C/S/Q/Z">`, `<rect>`, `<circle>`, `<ellipse>`, `<line>`, `<polyline>`, `<polygon>`.
- [x] **Embedded Images:** High-resolution PNG and JPEG images embedded as native PDF `/XObject` images with Flate/DCT compression.
- [x] **ISO Code 128 Barcodes & Dynamic QR Codes:** Native vector `<barcode>` (ISO/IEC 15417 Set B with mod-103 checksum) and `<qr>` (ISO/IEC 18004 Versions 1–10 up to 271 bytes).
- [x] **2D Multi-Page Tables & Advanced Matrices:** Both `rowspan` and `colspan` supported via a 2D grid occupancy matrix (`occupied[r][c]`), nested `<table>` elements inside `<td>` cells, `<tfoot>` summary rows, automatic `<thead>` repeating across page breaks, and running `headerText`/`Page {{page}} of {{pages}}` footers.
- [x] **Hirschberg–Larmore Optimal Line Breaking:** $O(n)$ least-weight subsequence paragraph breaking exploiting Monge-matrix properties on line-slack demerits.
- [x] **TrueType (`.ttf`) Font Embedding & Unicode:** Zero-dependency binary TTF parser, `/Type0` `/Identity-H` CIDFont embedding with `/ToUnicode` CMap streams, custom font loading, and extensive Unicode currency symbol support (`$`, `€`, `£`, `₹`, `¥`, `™`, `©`, `•`, `✓`, `→`).
- [x] **Embedded JSON Data:** Your structured data attached as `/EmbeddedFiles` `velox-payload.json` inside the signed `/ByteRange`, readable via `extractEmbeddedData` without OCR.
- [x] **Futamura Parametric Compiler:** Pre-compilation for about 0.013 ms fixed-topology rendering, with full layout and pagination when the `{{range}}` row count changes.
- [x] **DOM-VM Script Execution (trusted templates only):** `node:vm` context with a 50ms sync timeout for author-controlled Canvas2D scripts. Not a security boundary; do not run untrusted HTML with scripts enabled (see section 5).
- [x] **ISO 32000-1 Digital Signatures & Universal WebCrypto:** `/Type /Sig`, exact 4-tuple `/ByteRange`, DER-encoded PKCS#7 / CMS `adbe.pkcs7.detached`, tamper verification (about 0.07 ms), plus async WebCrypto (`renderPdfAsync`, `signPdfAsync`, `verifyPdfSignatureAsync`) for edge runtime compatibility.
- [x] **W3C CSS Specificity Precedence (Level 3):** Strict `(id * 1,000,000 + class * 1,000 + tag)` rule sorting, ensuring `#id` beats `.class` beats tag regardless of stylesheet declaration order, with inline `style="..."` priority and `!important` preservation.
- [x] **Self-Contained Browser Bundle:** Zero-backend browser ESM bundle (`public/veloxpdf.browser.js`) compiled via `npm run build:browser` with built-in `Uint8Array` / `Buffer` and DEFLATE shims.
- [x] **100-Document Batch Mail-Merge:** Parametric bytecode compilation generating 100 distinct customer invoices in about 1 ms.
- [x] **Drag-and-Drop PDF Verifier & JSON/CSV Extractor:** Drag-and-drop verification and OCR-free JSON extraction with automatic CSV conversion.

### Intentional Scope & Non-Goals
- **Transactional & Operational Focus:** VeloxPDF is engineered for high-throughput, deterministic documents. It is intentionally NOT a web browser engine for rendering arbitrary interactive websites with DOM event listeners, video/audio playback, or CSS 3D perspectives.
- **Static Print Target:** PDF is a static vector print format; interactive browser animations, hover transitions, and JavaScript interval timers are not applicable.
- **Remote Images Need `renderPdfAsync`:** `htmlToPdf` is synchronous and cannot fetch `http(s)` images, so use `renderPdfAsync` (5 s timeout, 5 MB cap, PNG/JPEG only, silent fallback on failure) or inline them as `data:` URLs.
- **Complex Text Shaping (CTL):** TrueType embedding supports universal Unicode glyphs (Latin, Cyrillic, Greek, CJK, currency symbols, math operators). Complex bidirectional cursive shaping for Arabic/Hebrew (HarfBuzz `GSUB`/`GPOS` OpenType layout tables) is not bundled to maintain 0 npm dependencies and keep renders around 2 ms.

---

## Testing

Run the comprehensive test suite:

```bash
npm test
```

The 26-test verification suite covers:
1. **Punctuation spacing glue:** Prevents stray spaces before punctuation (`noLeadingSpace`).
2. **Table numeric header alignment:** Header columns automatically right-align to match numeric body cells.
3. **Running headers & footers:** Repeating `headerText` and `Page X of Y` footers across multi-page tables.
4. **Visual cryptographic seal:** Distinct unsigned vs. signed `visualSeal` rendering.
5. **SVG vector path rendering:** Bézier curves, arcs, lines, and complex polygons.
6. **Dynamic QR codes:** High-capacity ISO Reed-Solomon payloads exceeding 100+ bytes.
7. **ISO Code 128 barcodes:** Deterministic symbol patterns and mod-103 checksums.
8. **X.509 PKCS#7 integrity:** Exact 4-tuple `/ByteRange` verification and 1-byte tamper rejection.
9. **Concurrent render isolation:** 20 concurrent renders without state bleed.
10. **Multi-page parametric compilation:** Deterministic multi-page parametric bytecode compilation.
11. **Table 2D grid matrix:** `rowspan` + `colspan` occupancy matrix, `<tfoot>` summary rows, and nested `<table>` elements inside `<td>`.
12. **Extended CSS layout:** `position: absolute` diagonal rotated watermark, `float: left`, `flex-wrap: wrap`, and dynamic `calc(100% - 40pt)`.
13. **Print media queries:** `@media print` CSS rule application and `@media screen` exclusion.
14. **Binary TrueType font parsing:** `parseTrueTypeFont` table parsing, `/Type0` `/Identity-H` `/ToUnicode` embedding, and Unicode currency symbols (`₹`, `€`, `£`, `¥`, em dash, `•`).
15. **Elastic Futamura variable arrays:** `compilePdfTemplate` dynamically expanding variable-length `{{range .Items}}` arrays (3 rows vs. 45 multi-page rows).
16. **VM script timeout:** Enforces the 50ms sync execution timeout for author Canvas2D scripts. Note: `node:vm` is not a security boundary (see section 5); this test does not assert isolation from untrusted input.
17. **Embedded images:** Native PDF `/XObject` rendering for PNG and JPEG images.
18. **WebCrypto asynchronous signing:** `signPdfAsync` and `verifyPdfSignatureAsync` round-trip and tamper detection via `crypto.subtle`.
19. **Rich multi-line table cells:** `<td>` cells with `<b>Title</b><br><span style="color:#64748b">Subtext</span>` and paragraph `<br>` tags producing distinct multi-line text operators and preserved vertical positions.
20. **Mixed block + inline children & N-child Flexbox:** `<div>` with mixed inline text and block children without dropping siblings, and multi-child Flexbox (`justify-content: space-between`, `flex-grow`) positioning.
21. **SVG elliptical arcs & `currentColor`:** SVG `<path>` with elliptical arc commands (`M 10 50 A 40 40 0 1 1 90 50`) and `stroke="currentColor"` compiled into cubic Bézier (`c`) operators in the PDF stream.
22. **Individual side borders & ascending xref subsections:** `border-left`, `border-top`, `box-shadow` vector primitives, and ISO 32000-1 §7.5.4 strictly ascending incremental xref subsection IDs.
23. **W3C CSS Specificity Precedence:** `#hero-id` (`#16a34a`) beats `.card-class` (`#2563eb`) which beats `div` (`#dc2626`) regardless of stylesheet order, inline `style="..."` beats all stylesheet rules, and `computeSelectorSpecificity` verifies ID > Class > Tag hierarchy.
24. **100-Document Batch Mail-Merge via `compilePdfTemplate`:** Compiles template once and generates 100 distinct customer PDFs in `< 50 ms` total (<0.5ms/doc) as valid `%PDF-1.7` `Uint8Array`s with zero cross-contamination sampled across invoices #1, #50, and #100.
25. **Embedded JSON extraction & signed tamper protection:** Renders signed invoice with structured `data`, recovers exact JSON deeply equal to `data` in `< 2 ms` via `extractEmbeddedData`, and verifies that flipping 1 byte inside the embedded JSON stream triggers cryptographic signature failure (`valid: false, tamperDetected: true`).
26. **Browser Bundle & Standalone API Contract:** Verifies `computeSelectorSpecificity`, `extractEmbeddedData`, `buildMinimalTrueTypeFont`, and `parseTrueTypeFont` handle raw `Uint8Array` inputs cleanly without requiring Node.js Buffer wrappers.
---

## License

MIT © VeloxPDF Contributors. Free for personal and commercial use.
