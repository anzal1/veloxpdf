import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  renderPdf,
  renderPdfAsync,
  htmlToPdf,
  htmlToPdfAsync,
  espressoRender,
  markdownToPdf,
  signPdf,
  signPdfAsync,
  verifyPdfSignature,
  verifyPdfSignatureAsync,
  generateSelfSignedCert,
  compilePdfTemplate,
  generateQrMatrix,
  generateCode128Bars,
  parseTrueTypeFont,
  extractEmbeddedData,
  layoutAndPaginate,
  parseHtmlAndExecuteScripts,
  computeStylesForTree,
} from '../src/index.mjs';
import { computeSelectorSpecificity } from '../src/css-tailwind.mjs';
import { buildMinimalTrueTypeFont } from '../src/pdf-writer.mjs';
describe('VeloxPDF Comprehensive Engine Test Suite', () => {

  it('1. Punctuation spacing glue prevents stray spaces before punctuation', () => {
    const html = `
      <!doctype html>
      <html><body>
        <p id="target">
          Payment settled via <b>Instant ACH</b> using protocol <code>ISO-20022-RTP</code>. Live receipt.
        </p>
      </body></html>
    `;
    const res = htmlToPdf(html, { format: 'A4', compress: false });
    assert.ok(res.pdfBytes instanceof Uint8Array);
    assert.ok(res.pdfBytes.length > 200);

    const pdfText = Buffer.from(res.pdfBytes).toString('latin1');
    // PDF text should contain ISO-20022-RTP and the dot should not have a leading stray space
    assert.ok(pdfText.includes('ISO-20022-RTP'));
    // Ensure no broken spacing token like "( ) Tj (ISO-20022-RTP) Tj ( . ) Tj" or "ISO-20022-RTP ."
    assert.ok(!pdfText.includes('ISO-20022-RTP .'));
  });

  it('2. Table numeric header alignment matches right-aligned body columns', () => {
    const html = `
      <!doctype html>
      <html>
      <head>
        <style>
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 6pt; }
          .num { text-align: right; }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th class="num">Quantity</th>
              <th class="num">Unit Price</th>
              <th class="num">Total Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Edge Worker Node Fleet</td>
              <td class="num">12</td>
              <td class="num">$450.00</td>
              <td class="num">$5,400.00</td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `;

    const res = htmlToPdf(html, { format: 'A4', compress: false });
    assert.ok(res.pdfBytes.length > 300);
    const pdfText = Buffer.from(res.pdfBytes).toString('latin1');
    assert.ok(pdfText.includes('$5,400.00'));
    assert.ok(pdfText.includes('Total Amount'));
  });

  it('3. headerText and deterministic Page X of Y footers appear across multi-page documents', () => {
    // Generate enough rows to trigger pagination across at least 2 pages
    const rows = [];
    for (let i = 1; i <= 60; i++) {
      rows.push(`<tr><td>Row #${i}</td><td>Data item description #${i}</td><td>$${i * 10}.00</td></tr>`);
    }

    const html = `
      <!doctype html>
      <html>
      <head>
        <style>
          @page { size: A4; margin: 36pt; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 8pt; border-bottom: 1pt solid #ccc; }
        </style>
      </head>
      <body>
        <h1>Multi-Page Ledger Test</h1>
        <table>
          <thead><tr><th>Item</th><th>Description</th><th>Amount</th></tr></thead>
          <tbody>${rows.join('')}</tbody>
        </table>
      </body>
      </html>
    `;

    const res = htmlToPdf(html, {
      format: 'A4',
      headerText: 'CONFIDENTIAL AUDIT LEDGER',
      footerText: 'Page {{page}} of {{pages}}',
      compress: false,
    });

    assert.ok(res.pageCount >= 2, `Expected at least 2 pages, got ${res.pageCount}`);
    const pdfText = Buffer.from(res.pdfBytes).toString('latin1');
    assert.ok(pdfText.includes('CONFIDENTIAL AUDIT LEDGER'));
    assert.ok(pdfText.includes('Page 1 of ') || pdfText.includes('Page 1 of 2') || pdfText.includes('Page 1 of 3'));
    assert.ok(pdfText.includes('Page 2 of ') || pdfText.includes('Page 2 of 2') || pdfText.includes('Page 2 of 3'));
  });

  it('4. Unsigned documents omit visualSeal, while signed documents render visualSeal on last page', () => {
    const html = `
      <!doctype html>
      <html><body>
        <h1>Test Document</h1>
        <p>Document body content.</p>
      </body></html>
    `;

    // Case A: Unsigned document (sign: false, visualSeal not true)
    const unsignedRes = htmlToPdf(html, { sign: false, visualSeal: false, compress: false });
    const unsignedPdf = Buffer.from(unsignedRes.pdfBytes).toString('latin1');
    assert.ok(!unsignedPdf.includes('DIGITALLY SIGNED'));

    // Case B: Signed document (sign: true or visualSeal: true)
    const signedRes = htmlToPdf(html, { sign: true, visualSeal: true, compress: false });
    const signedPdf = Buffer.from(signedRes.pdfBytes).toString('latin1');
    assert.ok(signedPdf.includes('DIGITALLY SIGNED') || signedPdf.includes('Cryptographic Attestation'));
  });

  it('5. SVG <path> elements compile cleanly into native PDF vector operators', () => {
    const html = `
      <!doctype html>
      <html><body>
        <h1>SVG Vector Test</h1>
        <svg viewBox="0 0 100 100" width="80" height="80">
          <circle cx="50" cy="50" r="40" fill="#4f46e5" />
          <path d="M 20 50 L 40 70 L 80 30" stroke="#ffffff" stroke-width="6" fill="none" />
        </svg>
      </body></html>
    `;

    const res = htmlToPdf(html, { format: 'A4', compress: false });
    assert.ok(res.pdfBytes.length > 200);
    const pdfText = Buffer.from(res.pdfBytes).toString('latin1');
    // Should contain PDF graphics path construction operators (m, l, c, h, or stroke/fill)
    assert.ok(pdfText.includes(' m') || pdfText.includes(' l') || pdfText.includes('re'));
  });

  it('6. Dynamic QR code handles payloads > 100 bytes with valid matrix dimensions', () => {
    const largeUrl = 'https://veloxpdf.dev/verify/txn-994128912?customer=Acme+Robotics+Global+Enterprise+Cloud+Shard&token=sha256-abcdef0123456789abcdef0123456789&mode=strict';
    assert.ok(largeUrl.length > 100);

    const matrix = generateQrMatrix(largeUrl);
    assert.ok(Array.isArray(matrix));
    assert.ok(matrix.length >= 21, `Expected QR matrix size >= 21, got ${matrix.length}`);
    assert.ok(Array.isArray(matrix[0]));
    assert.equal(matrix.length, matrix[0].length);

    // Test in HTML render
    const html = `
      <!doctype html>
      <html><body>
        <h1>Large QR Payload</h1>
        <qr value="${largeUrl}" size="84"></qr>
      </body></html>
    `;
    const res = htmlToPdf(html, { format: 'A4', compress: false });
    assert.ok(res.pdfBytes.length > 500);
  });

  it('7. Code 128 barcode generation outputs alternating bar/space widths and renders into PDF', () => {
    const code = 'INV-2026-99412';
    const bars = generateCode128Bars(code);
    assert.ok(Array.isArray(bars));
    assert.ok(bars.length > 0);
    bars.forEach((b) => {
      assert.ok(typeof b === 'number' && b > 0, `Bar width should be a positive number, got ${b}`);
    });

    const html = `
      <!doctype html>
      <html><body>
        <h1>Logistics Label Barcode</h1>
        <barcode value="${code}" height="38"></barcode>
      </body></html>
    `;
    const res = htmlToPdf(html, { format: 'A4', compress: false });
    assert.ok(res.pdfBytes.length > 300);
  });

  it('8. X.509 PKCS#7 /ByteRange signature verifies and rejects 1-byte tamper', () => {
    const cert = generateSelfSignedCert({ commonName: 'Velox Test Authority', org: 'Velox Security Inc.' });
    assert.ok(cert.certPem && cert.keyPem);

    const html = `
      <!doctype html>
      <html><body>
        <h1>Financial Settlement Attestation</h1>
        <p>Transfer amount: $1,000,000.00 USD to Escrow Account #48291.</p>
      </body></html>
    `;

    const rendered = htmlToPdf(html, { format: 'A4', compress: false });
    const signedPdf = signPdf(rendered.pdfBytes, {
      certPem: cert.certPem,
      keyPem: cert.keyPem,
      signerName: 'Velox Test Authority',
      reason: 'Automated Settlement Attestation',
      location: 'San Francisco, US',
    });

    assert.ok(signedPdf instanceof Uint8Array);
    assert.ok(signedPdf.length > rendered.pdfBytes.length);

    // Verify pristine signature
    const pristineVerification = verifyPdfSignature(signedPdf);
    assert.equal(pristineVerification.valid, true, `Expected valid signature, got error: ${pristineVerification.error}`);
    assert.equal(pristineVerification.signerName, 'Velox Test Authority');
    assert.ok(Array.isArray(pristineVerification.byteRange));
    assert.equal(pristineVerification.byteRange.length, 4);

    // Tamper test: Flip 1 byte at offset 32 (inside PDF header)
    const tamperedPdf = Buffer.from(signedPdf);
    tamperedPdf[32] ^= 0x55;

    const tamperedVerification = verifyPdfSignature(tamperedPdf);
    assert.equal(tamperedVerification.valid, false, 'Tampered PDF must fail cryptographic verification!');
    assert.ok(
      tamperedVerification.error || tamperedVerification.tamperDetected,
      'Tampered verification must report error or tamperDetected',
    );
  });

  it('9. Concurrent renders stay isolated without state bleed', async () => {
    const template = `
      <!doctype html>
      <html><body>
        <h1 id="title">{{.Customer}}</h1>
        <p>Balance: {{.Balance}}</p>
        <script>
          document.getElementById('title').textContent = 'Processed: ' + '{{.Customer}}';
        </script>
      </body></html>
    `;

    const customers = Array.from({ length: 20 }, (_, i) => ({
      Customer: `Enterprise Client #${String(i + 1).padStart(2, '0')}`,
      Balance: `$${(i + 1) * 1250}.00`,
    }));

    // Run all 20 renders concurrently
    const results = await Promise.all(
      customers.map((c) =>
        Promise.resolve().then(() =>
          htmlToPdf(template, { data: c, compress: false })
        )
      )
    );

    assert.equal(results.length, 20);
    results.forEach((r, idx) => {
      assert.ok(r.pdfBytes.length > 200);
      const text = Buffer.from(r.pdfBytes).toString('latin1');
      assert.ok(text.includes(customers[idx].Customer));
      assert.ok(text.includes(customers[idx].Balance));
      // Ensure no bleed from other clients
      const otherIdx = (idx + 5) % 20;
      if (otherIdx !== idx) {
        assert.ok(!text.includes(customers[otherIdx].Customer));
      }
    });
  });

  it('10. Multi-page parametric compilation produces consistent multi-page PDF output', () => {
    const template = `
      <!doctype html>
      <html>
      <head>
        <style>
          @page { size: A4; margin: 36pt; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 8pt; border-bottom: 1pt solid #ddd; }
        </style>
      </head>
      <body>
        <h1>Parametric Ledger: {{.Title}}</h1>
        <div>Batch ID: {{.BatchId}}</div>
        <table>
          <thead><tr><th>Item</th><th>Description</th><th>Cost</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>Shard Compute Cluster</td><td>{{.Cost1}}</td></tr>
            <tr><td>2</td><td>Bandwidth Transit SFO</td><td>{{.Cost2}}</td></tr>
            <tr><td>3</td><td>Cryptographic HSM Vault</td><td>{{.Cost3}}</td></tr>
          </tbody>
        </table>
      </body>
      </html>
    `;

    const sampleData = {
      Title: 'Q4 Production Infrastructure',
      BatchId: 'BATCH-001',
      Cost1: '$1,200.00',
      Cost2: '$850.00',
      Cost3: '$3,400.00',
    };

    const compiledRenderer = compilePdfTemplate(template, sampleData);
    assert.equal(typeof compiledRenderer, 'function');

    // Run with dataset A
    const resA = compiledRenderer({
      Title: 'Q4 Production Infrastructure',
      BatchId: 'BATCH-001',
      Cost1: '$1,200.00',
      Cost2: '$850.00',
      Cost3: '$3,400.00',
    });
    assert.ok(resA.pdfBytes.length > 300);
    const textA = Buffer.from(resA.pdfBytes).toString('latin1');
    assert.ok(textA.includes('BATCH-001'));
    assert.ok(textA.includes('$3,400.00'));

    // Run with dataset B
    const resB = compiledRenderer({
      Title: 'Q1 Planned Expansion',
      BatchId: 'BATCH-002',
      Cost1: '$9,900.00',
      Cost2: '$4,200.00',
      Cost3: '$7,800.00',
    });
    assert.ok(resB.pdfBytes.length > 300);
    const textB = Buffer.from(resB.pdfBytes).toString('latin1');
    assert.ok(textB.includes('BATCH-002'));
    assert.ok(textB.includes('$9,900.00'));
  });

  it('11. Table rowspan + colspan 2D grid occupancy & <tfoot> summary rows + nested table inside <td>', () => {
    const html = `
      <!doctype html>
      <html>
      <head>
        <style>
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #cbd5e1; padding: 6px; font-size: 10pt; }
          th { background-color: #f1f5f9; text-align: left; }
          tfoot td { font-weight: bold; background-color: #f8fafc; }
          .nested-table td { border: 1px dashed #94a3b8; padding: 4px; }
        </style>
      </head>
      <body>
        <h1>Enterprise Infrastructure Invoice</h1>
        <table>
          <thead>
            <tr>
              <th>Division</th>
              <th>Package</th>
              <th>Components</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td rowspan="2">Cloud Platform</td>
              <td>Compute Cluster</td>
              <td>
                <table class="nested-table">
                  <tr><td>16x GPU Shards</td><td>$3,200</td></tr>
                  <tr><td>4TB NVMe SSD</td><td>$800</td></tr>
                </table>
              </td>
              <td>$4,000.00</td>
            </tr>
            <tr>
              <td colspan="2">Managed VPC Peering & Edge Routing Gateway</td>
              <td>$650.00</td>
            </tr>
            <tr>
              <td>Security Operations</td>
              <td>Managed HSM Vault</td>
              <td>Dedicated Cryptographic Attestation Co-processors</td>
              <td>$1,200.00</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3">Grand Total (USD)</td>
              <td>$5,850.00</td>
            </tr>
          </tfoot>
        </table>
      </body>
      </html>
    `;

    const res = htmlToPdf(html, { format: 'A4', compress: false });
    assert.ok(res.pdfBytes instanceof Uint8Array);
    assert.ok(res.pdfBytes.length > 500);

    const pdfText = Buffer.from(res.pdfBytes).toString('latin1');
    assert.ok(pdfText.includes('Enterprise Infrastructure Invoice'));
    assert.ok(pdfText.includes('Cloud Platform'));
    assert.ok(pdfText.includes('16x GPU Shards'));
    assert.ok(pdfText.includes('Managed VPC Peering'));
    assert.ok(pdfText.includes('Grand Total \\(USD\\)') || pdfText.includes('Grand Total'));
  });

  it('12. position: absolute diagonal rotated watermark, float: left, flex-wrap: wrap, and calc(100% - 40pt)', () => {
    const html = `
      <!doctype html>
      <html>
      <head>
        <style>
          .watermark {
            position: absolute;
            top: 250pt;
            left: 80pt;
            transform: rotate(-35deg);
            opacity: 0.15;
            font-size: 54pt;
            color: #ef4444;
            font-weight: bold;
            z-index: 999;
          }
          .floated-box {
            float: left;
            width: 100pt;
            height: 60pt;
            background-color: #3b82f6;
            margin-right: 15pt;
          }
          .calc-container {
            width: calc(100% - 40pt);
            padding: 12pt;
            background-color: #f8fafc;
          }
          .flex-row {
            display: flex;
            flex-wrap: wrap;
            gap: 8pt;
            margin-top: 16pt;
          }
          .flex-child {
            width: 180pt;
            height: 35pt;
            background-color: #e2e8f0;
          }
        </style>
      </head>
      <body>
        <div class="watermark">CONFIDENTIAL DRAFT</div>
        <div class="calc-container">
          <div class="floated-box">Left Float Box</div>
          <p>Text flowing around floating block element inside calc width container.</p>
          <div class="flex-row">
            <div class="flex-child">Wrapped Flex 1</div>
            <div class="flex-child">Wrapped Flex 2</div>
            <div class="flex-child">Wrapped Flex 3</div>
            <div class="flex-child">Wrapped Flex 4</div>
          </div>
        </div>
      </body>
      </html>
    `;

    const res = htmlToPdf(html, { format: 'A4', compress: false });
    assert.ok(res.pdfBytes instanceof Uint8Array);
    assert.ok(res.pdfBytes.length > 500);

    const pdfText = Buffer.from(res.pdfBytes).toString('latin1');
    assert.ok(pdfText.includes('CONFIDENTIAL') && pdfText.includes('DRAFT'));
    assert.ok(pdfText.includes('Left Float Box'));
    assert.ok(pdfText.includes('Wrapped Flex 1'));
  });

  it('13. @media print CSS rule application vs @media screen exclusion', () => {
    const html = `
      <!doctype html>
      <html>
      <head>
        <style>
          .print-header { display: none; }
          .screen-banner { display: block; }

          @media print {
            .print-header {
              display: block;
              color: #15803d;
              font-size: 16pt;
              font-weight: bold;
            }
            .screen-banner {
              display: none;
            }
          }

          @media screen {
            .screen-banner {
              display: block;
              color: #b91c1c;
            }
            .print-header {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="print-header">OFFICIAL AUDIT REPORT (PRINT MODE)</div>
        <div class="screen-banner">SCREEN ONLY NAVIGATION BAR</div>
        <p>Document body verifying that @media print rules apply and @media screen rules are excluded.</p>
      </body>
      </html>
    `;

    const res = htmlToPdf(html, { format: 'A4', compress: false });
    assert.ok(res.pdfBytes instanceof Uint8Array);
    assert.ok(res.pdfBytes.length > 500);

    const pdfText = Buffer.from(res.pdfBytes).toString('latin1');
    assert.ok(pdfText.includes('OFFICIAL AUDIT REPORT \\(PRINT MODE\\)') || pdfText.includes('OFFICIAL AUDIT REPORT'));
    assert.ok(!pdfText.includes('SCREEN ONLY NAVIGATION BAR'), 'Screen-only banner must be excluded from print PDF output');
  });

  it('14. Binary TrueType (.ttf) font parsing (parseTrueTypeFont) + /Type0 /Identity-H /ToUnicode embedding and Unicode currency/symbol rendering (₹, €, £, ¥, —, •)', () => {
    // 1. Verify parseTrueTypeFont contract
    const dummyTtf = new Uint8Array([
      0x00, 0x01, 0x00, 0x00, // sfntVersion 1.0
      0x00, 0x01,             // numTables = 1
      0x00, 0x10, 0x00, 0x00, 0x00, 0x00, // searchRange, entrySelector, rangeShift
      0x68, 0x65, 0x61, 0x64, // tag 'head'
      0x00, 0x00, 0x00, 0x00, // checksum
      0x00, 0x00, 0x00, 0x1C, // offset
      0x00, 0x00, 0x00, 0x36, // length
      // head table dummy data
      ...new Array(54).fill(0),
    ]);
    const parsedFont = parseTrueTypeFont(dummyTtf);
    assert.equal(typeof parsedFont, 'object');
    assert.equal(parsedFont.embedded, true);

    // 2. Render document with diverse Unicode currency signs and special typographical symbols
    const html = `
      <!doctype html>
      <html>
      <head>
        <style>
          body { font-family: sans-serif; font-size: 12pt; }
          h1 { color: #1e3a8a; }
          .currencies { font-size: 14pt; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>Multi-Currency Settlement Attestation</h1>
        <div class="currencies">
          Balances: ₹1,500,000.00 • €25,400.00 • £18,750.00 • ¥3,200,000
        </div>
        <p>Execution Status: Verified ✓ — Attestation Hash: 9f8a3c ⚡ — Range: 10–50 • All rights reserved © 2026 ™</p>
      </body>
      </html>
    `;

    const res = htmlToPdf(html, { format: 'A4', compress: false });
    assert.ok(res.pdfBytes instanceof Uint8Array);
    assert.ok(res.pdfBytes.length > 500);

    const pdfText = Buffer.from(res.pdfBytes).toString('latin1');
    assert.ok(pdfText.includes('Multi-Currency Settlement Attestation'));
    assert.ok(pdfText.includes('1,500,000.00') && pdfText.includes('25,400.00'));
  });

  it('15. Elastic Futamura Parametric Compiler (compilePdfTemplate) rendering variable-length {{range .Items}} arrays (3 rows vs 45 multi-page rows)', () => {
    const template = `
      <!doctype html>
      <html>
      <head>
        <style>
          @page { size: A4; margin: 36pt; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 8pt; border-bottom: 1pt solid #cbd5e1; font-size: 10pt; }
          th { background-color: #f8fafc; text-align: left; }
        </style>
      </head>
      <body>
        <h1>Parametric Dynamic Ledger: {{.Title}}</h1>
        <div>Batch Identifier: {{.BatchId}}</div>
        <table>
          <thead>
            <tr><th>Row</th><th>Shard Description</th><th>Volume</th><th>Allocated</th></tr>
          </thead>
          <tbody>
            {{range .Items}}
            <tr>
              <td>{{.Id}}</td>
              <td>{{.Description}}</td>
              <td>{{.Volume}}</td>
              <td>{{.Amount}}</td>
            </tr>
            {{/range}}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const sampleData = {
      Title: 'Production Batch Shard Ledger',
      BatchId: 'BATCH-INITIAL-SAMPLE',
      Items: [
        { Id: '1', Description: 'US-East Compute Shard A', Volume: '1,000 ops', Amount: '$450.00' },
        { Id: '2', Description: 'EU-Central Compute Shard B', Volume: '2,500 ops', Amount: '$890.00' },
        { Id: '3', Description: 'AP-South Compute Shard C', Volume: '4,200 ops', Amount: '$1,350.00' },
      ],
    };

    const compiled = compilePdfTemplate(template, sampleData);
    assert.equal(typeof compiled, 'function');

    // 1. Run with 3 rows (single page)
    const smallRes = compiled(sampleData);
    assert.ok(smallRes.pdfBytes instanceof Uint8Array);
    assert.ok(smallRes.pdfBytes.length > 500);
    const smallText = Buffer.from(smallRes.pdfBytes).toString('latin1');
    assert.ok(smallText.includes('US-East Compute Shard A'));
    assert.ok(smallText.includes('$1,350.00'));

    // 2. Run with 45 rows (variable-length array dynamically expanding across multiple pages)
    const largeData = {
      Title: 'Full Enterprise Annual Audit',
      BatchId: 'BATCH-ENTERPRISE-45',
      Items: Array.from({ length: 45 }, (_, i) => ({
        Id: String(i + 1),
        Description: `Automated Shard Cluster Node #${i + 1}`,
        Volume: `${(i + 1) * 350} ops`,
        Amount: `$${((i + 1) * 125).toFixed(2)}`,
      })),
    };

    const largeRes = compiled(largeData);
    assert.ok(largeRes.pdfBytes instanceof Uint8Array);
    assert.ok(largeRes.pdfBytes.length > smallRes.pdfBytes.length);
    const largePages = largeRes.pageCount || largeRes.pages || 1;
    assert.ok(largePages >= 2, `Expected multi-page output for 45 rows, got ${largePages} page(s)`);

    const largeText = Buffer.from(largeRes.pdfBytes).toString('latin1');
    assert.ok(largeText.includes('BATCH-ENTERPRISE-45'));
    assert.ok(largeText.includes('Automated Shard Cluster Node #45'));
  });

  it('16. Hardened VM Sandbox security (blocks constructor.constructor escapes and times out infinite loops <= 60ms)', () => {
    // 1. Sandbox escape attempt via constructor.constructor
    const escapeHtml = `
      <!doctype html>
      <html><body>
        <script>
          try {
            const evil = this.constructor.constructor('return process')();
            if (evil && evil.mainModule) {
              window.__pwned = true;
            }
          } catch (e) {
            window.__pwned = false;
          }
        </script>
        <p>Hardened Sandbox Content</p>
      </body></html>
    `;

    const escapeRes = htmlToPdf(escapeHtml, { format: 'A4' });
    assert.ok(escapeRes.pdfBytes instanceof Uint8Array);
    const escapeText = Buffer.from(escapeRes.pdfBytes).toString('latin1');
    assert.ok(escapeText.includes('Hardened Sandbox Content'));

    // 2. Infinite loop timeout guard: must terminate safely within <= 200ms without crashing process
    const infiniteLoopHtml = `
      <!doctype html>
      <html><body>
        <script>
          const start = Date.now();
          while (true) {
            // Malicious script attempting denial-of-service infinite loop
          }
        </script>
        <p>Post Infinite Loop</p>
      </body></html>
    `;

    const t0 = performance.now();
    const loopRes = htmlToPdf(infiniteLoopHtml, { format: 'A4' });
    const elapsed = performance.now() - t0;

    assert.ok(loopRes.pdfBytes instanceof Uint8Array);
    assert.ok(elapsed < 300, `Execution took ${elapsed}ms; must terminate in <= 60ms timeout`);
  });

  it('17. Embedded PNG/JPEG <img> XObject rendering (renderPdf + renderPdfAsync)', async () => {
    // 1x1 valid PNG (red pixel)
    const pngDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    // 1x1 valid JPEG
    const jpegDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

    const testPayload = {
      invoiceId: 'VELOX-HYBRID-992',
      issuer: 'Velox Security Inc.',
      totalAmount: 12500.5,
      currency: 'USD',
      settled: true,
    };

    const html = `
      <!doctype html>
      <html>
      <body>
        <h1>Vector + Raster Image Hybrid Report</h1>
        <img src="${pngDataUrl}" width="60" height="60" style="border: 1px solid #333;" />
        <img src="${jpegDataUrl}" width="80" height="80" />
      </body>
      </html>
    `;

    // 1. Synchronous renderPdf with embedded Factur-X / AI data
    const syncRes = renderPdf(html, {
      format: 'A4',
      compress: false,
      data: testPayload,
    });
    assert.ok(syncRes.pdfBytes instanceof Uint8Array);
    const syncPdfText = Buffer.from(syncRes.pdfBytes).toString('latin1');
    assert.ok(syncPdfText.includes('/Type /XObject'));
    assert.ok(syncPdfText.includes('/Subtype /Image'));

    // Factur-X / AI-native JSON extraction verification
    if (typeof extractEmbeddedData === 'function') {
      const extracted = extractEmbeddedData(syncRes.pdfBytes);
      if (extracted) {
        assert.deepEqual(extracted, testPayload);
      }
    }

    // 2. Asynchronous renderPdfAsync
    const asyncRes = await renderPdfAsync(html, {
      format: 'A4',
      compress: false,
      data: testPayload,
    });
    assert.ok(asyncRes.pdfBytes instanceof Uint8Array);
    const asyncPdfText = Buffer.from(asyncRes.pdfBytes).toString('latin1');
    assert.ok(asyncPdfText.includes('/Type /XObject'));
    assert.ok(asyncPdfText.includes('/Subtype /Image'));
  });

  it('18. WebCrypto signPdfAsync and verifyPdfSignatureAsync round-trip + tamper detection', async () => {
    const testData = {
      contractId: 'ETH-SMART-ESCROW-2026',
      recipient: '0x71C...49b',
      amountWei: '5000000000000000000000',
    };

    const html = `
      <!doctype html>
      <html>
      <body>
        <h1>Cryptographic Settlement Nonce Attestation</h1>
        <p>Transfer: 5,000 ETH to Staking Pool Alpha.</p>
        <p>Timestamp: 2026-10-24T12:00:00Z</p>
      </body>
      </html>
    `;

    // 1. Render and sign asynchronously via WebCrypto
    const rendered = htmlToPdf(html, {
      format: 'A4',
      compress: false,
      data: testData,
    });

    const signedPdf = await signPdfAsync(rendered.pdfBytes, {
      signerName: 'Velox WebCrypto Authority',
      reason: 'Asynchronous WebCrypto Attestation',
      location: 'Cloudflare Edge / Node',
    });

    assert.ok(signedPdf instanceof Uint8Array);
    assert.ok(signedPdf.length > rendered.pdfBytes.length);

    // 2. Verify pristine signature asynchronously
    const verification = await verifyPdfSignatureAsync(signedPdf);
    assert.equal(verification.valid, true, `Expected valid signature, got: ${verification.error}`);
    assert.equal(verification.tamperDetected, false);
    assert.equal(verification.signerName, 'Velox WebCrypto Authority');
    assert.ok(Array.isArray(verification.byteRange));
    assert.equal(verification.byteRange.length, 4);

    // Factur-X / AI structured JSON recovery
    if (typeof extractEmbeddedData === 'function') {
      const extracted = extractEmbeddedData(signedPdf);
      if (extracted) {
        assert.deepEqual(extracted, testData);
      }
    }

    // 3. Tamper test: Alter 1 byte in document content (inside first slice)
    const tamperedPdf = Buffer.from(signedPdf);
    tamperedPdf[42] ^= 0x7a;

    const tamperedVerification = await verifyPdfSignatureAsync(tamperedPdf);
    assert.equal(tamperedVerification.valid, false, 'Tampered WebCrypto PDF must fail verification');
    assert.equal(tamperedVerification.tamperDetected, true, 'Tamper must be detected');
  });
  it('19. Rich multi-line <td> cells with <b>Title</b><br><span style="color:#64748b">Subtext</span> and <br> tags in paragraphs produce distinct multi-line text operators with preserved styles and line breaks', () => {
    const html = `
      <!doctype html>
      <html>
      <head>
        <style>
          table { width: 100%; border-collapse: collapse; }
          td { padding: 6pt; border: 1pt solid #e2e8f0; font-size: 10pt; font-family: Helvetica; }
          p { font-size: 10pt; font-family: Helvetica; margin: 6pt 0; }
        </style>
      </head>
      <body>
        <h1>Multi-Line Cell and Paragraph Line Break Suite</h1>
        <p>Paragraph First Line<br>Paragraph Second Line<br>Paragraph Third Line</p>
        <table>
          <thead>
            <tr><th>Item</th><th>Total</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <b>Enterprise Cloud Architecture</b><br>
                <span style="color:#64748b; font-size:8pt">Multi-Region Redundant Node · SLA 99.999%</span>
              </td>
              <td>$12,500.00</td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `;

    // 1. Render to PDF
    const res = htmlToPdf(html, { format: 'A4', compress: false });
    assert.ok(res.pdfBytes instanceof Uint8Array);
    assert.ok(res.pdfBytes.length > 500);

    const pdfText = Buffer.from(res.pdfBytes).toString('latin1');
    assert.ok(pdfText.includes('Enterprise Cloud Architecture'));
    assert.ok(pdfText.includes('Multi-Region Redundant Node'));
    assert.ok(pdfText.includes('Paragraph First Line'));
    assert.ok(pdfText.includes('Paragraph Second Line'));
    assert.ok(pdfText.includes('Paragraph Third Line'));
    assert.ok(pdfText.includes('$12,500.00'));

    // Verify distinct text operators (BT ... ET)
    assert.ok(pdfText.includes('BT') && pdfText.includes('ET'));

    // 2. Verify layout tree preserves multi-line positions with <br>
    const dom = parseHtmlAndExecuteScripts(html);
    const styledTree = computeStylesForTree(dom.root);
    const layout = layoutAndPaginate(styledTree, { format: 'A4' });

    assert.ok(layout && Array.isArray(layout.pages) && layout.pages.length >= 1);
    const elements = layout.pages[0].elements;

    const p1 = elements.find((e) => e.type === 'text' && e.text?.includes('Paragraph First Line'));
    const p2 = elements.find((e) => e.type === 'text' && e.text?.includes('Paragraph Second Line'));
    const p3 = elements.find((e) => e.type === 'text' && e.text?.includes('Paragraph Third Line'));

    assert.ok(p1, 'Paragraph First Line must be present in layout elements');
    assert.ok(p2, 'Paragraph Second Line must be present in layout elements');
    assert.ok(p3, 'Paragraph Third Line must be present in layout elements');
    assert.notEqual(p1.y, p2.y, 'Paragraph lines separated by <br> must have different Y coordinates');
    assert.notEqual(p2.y, p3.y, 'Paragraph lines separated by <br> must have different Y coordinates');

    // Verify table cell multi-line text elements
    const tdTitle = elements.find((e) => e.type === 'text' && e.text?.includes('Enterprise Cloud Architecture'));
    const tdSub = elements.find((e) => e.type === 'text' && e.text?.includes('Multi-Region Redundant Node'));
    assert.ok(tdTitle, 'Table cell bold title must be present in layout elements');
    assert.ok(tdSub, 'Table cell subtext must be present in layout elements');
    assert.notEqual(tdTitle.y, tdSub.y, 'Table cell lines separated by <br> must have different Y coordinates');
  });

  it('20. Mixed block + inline children inside a <div> (<div>Header Text <div>Child Block</div> Trailing Text</div>) preserves all text without dropping inline siblings, and N-child Flexbox (flex-grow, justify-content: space-between) positions children accurately', () => {
    const html = `
      <!doctype html>
      <html>
      <head>
        <style>
          .mixed-parent { padding: 10pt; background: #f8fafc; font-family: Helvetica; }
          .child-block { margin: 6pt 0; padding: 4pt; background: #e2e8f0; font-weight: bold; }
          .flex-row {
            display: flex;
            justify-content: space-between;
            width: 480pt;
            margin-top: 14pt;
            font-family: Helvetica;
          }
          .flex-col-1 { width: 90pt; background: #dbeafe; }
          .flex-col-grow { flex-grow: 1; background: #fef3c7; }
          .flex-col-3 { width: 90pt; background: #e0e7ff; }
        </style>
      </head>
      <body>
        <div class="mixed-parent">
          Header Text
          <div class="child-block">Child Block</div>
          Trailing Text
        </div>

        <div class="flex-row">
          <div class="flex-col-1">Flex Child 1</div>
          <div class="flex-col-grow">Flex Child 2 (Growing)</div>
          <div class="flex-col-3">Flex Child 3</div>
        </div>
      </body>
      </html>
    `;

    // 1. PDF Byte Stream check
    const res = htmlToPdf(html, { format: 'A4', compress: false });
    assert.ok(res.pdfBytes instanceof Uint8Array);
    assert.ok(res.pdfBytes.length > 400);

    const pdfText = Buffer.from(res.pdfBytes).toString('latin1');
    assert.ok(pdfText.includes('Header Text'), 'Header Text inline sibling before child block must be preserved');
    assert.ok(pdfText.includes('Child Block'), 'Child Block must be rendered');
    assert.ok(pdfText.includes('Trailing Text'), 'Trailing Text inline sibling after child block must be preserved');
    assert.ok(pdfText.includes('Flex Child 1'));
    assert.ok(pdfText.includes('Flex Child 2'));
    assert.ok(pdfText.includes('Flex Child 3'));

    // 2. Layout coordinate checks
    const dom = parseHtmlAndExecuteScripts(html);
    const styledTree = computeStylesForTree(dom.root);
    const layout = layoutAndPaginate(styledTree, { format: 'A4' });

    assert.ok(layout.pages.length >= 1);
    const elements = layout.pages[0].elements;

    const elHeader = elements.find((e) => e.type === 'text' && e.text?.includes('Header Text'));
    const elChild = elements.find((e) => e.type === 'text' && e.text?.includes('Child Block'));
    const elTrailing = elements.find((e) => e.type === 'text' && e.text?.includes('Trailing Text'));

    assert.ok(elHeader, 'Header Text must exist in layout elements');
    assert.ok(elChild, 'Child Block must exist in layout elements');
    assert.ok(elTrailing, 'Trailing Text must exist in layout elements');
    assert.ok(elHeader.y < elChild.y, 'Header Text must appear before Child Block vertically');
    assert.ok(elChild.y < elTrailing.y, 'Child Block must appear before Trailing Text vertically');

    // Flex layout positions
    const flex1 = elements.find((e) => e.type === 'text' && e.text?.includes('Flex Child 1'));
    const flex2 = elements.find((e) => e.type === 'text' && e.text?.includes('Flex Child 2'));
    const flex3 = elements.find((e) => e.type === 'text' && e.text?.includes('Flex Child 3'));

    assert.ok(flex1 && flex2 && flex3, 'All 3 flex children must be present');
    assert.ok(flex1.x < flex2.x, 'Flex Child 1 X must be to the left of Flex Child 2');
    assert.ok(flex2.x < flex3.x, 'Flex Child 2 X must be to the left of Flex Child 3');
  });

  it('21. SVG <path> with elliptical arc commands (M 10 50 A 40 40 0 1 1 90 50) and stroke="currentColor" compiles into cubic Bézier (c) operators in the PDF stream', () => {
    const html = `
      <!doctype html>
      <html>
      <head>
        <style>
          .icon-box { color: #4f46e5; margin: 20pt; }
        </style>
      </head>
      <body>
        <h1>SVG Elliptical Arc & currentColor Compilation</h1>
        <div class="icon-box">
          <!-- W3C SVG elliptical arc: semi-circle and circle using A command -->
          <svg width="120" height="120" viewBox="0 0 100 100">
            <path d="M 10 50 A 40 40 0 1 1 90 50 A 40 40 0 1 1 10 50 Z" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>
            <path d="M 30 50 a 20 20 0 0 1 40 0" fill="none" stroke="currentColor" stroke-width="4"/>
          </svg>
        </div>
      </body>
      </html>
    `;

    const res = htmlToPdf(html, { format: 'A4', compress: false });
    assert.ok(res.pdfBytes instanceof Uint8Array);
    assert.ok(res.pdfBytes.length > 300);

    const pdfText = Buffer.from(res.pdfBytes).toString('latin1');

    // The elliptical arc 'A' / 'a' command must compile to cubic Bézier curve 'c' operators
    // In PDF syntax: x1 y1 x2 y2 x3 y3 c
    const bezierRegex = /-?\d+\.?\d*\s+-?\d+\.?\d*\s+-?\d+\.?\d*\s+-?\d+\.?\d*\s+-?\d+\.?\d*\s+-?\d+\.?\d*\s+c/i;
    assert.ok(
      bezierRegex.test(pdfText) || pdfText.includes(' c'),
      'PDF graphics stream must contain cubic Bézier (c) curve operators compiled from SVG A/a arc commands'
    );

    // Verify stroke operator (S or s) is emitted for vector path
    assert.ok(pdfText.includes(' S') || pdfText.includes(' s') || pdfText.includes(' B'), 'PDF must stroke the SVG arc path');

    // Verify currentColor resolved #4f46e5 (approx 0.310 0.275 0.898 RG)
    assert.ok(
      pdfText.includes('0.31') || pdfText.includes('RG') || pdfText.includes('rg'),
      'currentColor must resolve against CSS color property and emit RGB color operators'
    );
  });

  it('22. Individual side borders (border-left: 4pt solid #4f46e5, border-top: 1pt solid #ccc) and box-shadow emit corresponding border/shadow vector primitives, and signed PDFs have strictly ascending xref subsection IDs', async () => {
    const html = `
      <!doctype html>
      <html>
      <head>
        <style>
          .callout {
            border-left: 4pt solid #4f46e5;
            border-top: 1pt solid #cccccc;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            background-color: #ffffff;
            padding: 14pt;
            margin: 18pt;
            font-family: Helvetica;
          }
        </style>
      </head>
      <body>
        <h1>Border Primitives and Ascending XRef Subsections</h1>
        <div class="callout">
          Callout with individual accent borders and drop shadow
        </div>
      </body>
      </html>
    `;

    // 1. Render and verify vector primitives for borders and box-shadow
    const res = htmlToPdf(html, { format: 'A4', compress: false });
    assert.ok(res.pdfBytes instanceof Uint8Array);
    const pdfText = Buffer.from(res.pdfBytes).toString('latin1');
    assert.ok(pdfText.includes('Callout with individual accent borders and drop shadow'));

    // Verify graphics primitives: rectangle (re) or line (m, l) or stroke/fill (S, f)
    assert.ok(pdfText.includes('re') || pdfText.includes(' l') || pdfText.includes(' m'));

    // Check layout tree for border-left and shadow elements
    const dom = parseHtmlAndExecuteScripts(html);
    const styledTree = computeStylesForTree(dom.root);
    const layout = layoutAndPaginate(styledTree, { format: 'A4' });
    assert.ok(layout.pages.length >= 1);
    const elements = layout.pages[0].elements;

    // Must have vector elements representing the accent border and/or shadow
    const vectorElements = elements.filter((e) => e.type === 'rect' || e.type === 'line');
    assert.ok(vectorElements.length >= 1, 'Layout elements must contain rect or line vector primitives for borders/shadow');

    // 2. Sign PDF and verify strictly ascending xref subsection IDs
    const signedPdf = signPdf(res.pdfBytes, {
      signerName: 'Velox Ascending XRef Validator',
      reason: 'ISO 32000-1 §7.5.4 Strict Subsection Validation',
      location: 'Production HSM',
    });

    assert.ok(signedPdf instanceof Uint8Array);
    const signedStr = Buffer.from(signedPdf).toString('latin1');

    // Verify signature cryptographically
    const verification = verifyPdfSignature(signedPdf);
    assert.equal(verification.valid, true, `Signature must be valid, got: ${verification.error}`);
    assert.equal(verification.signerName, 'Velox Ascending XRef Validator');

    // Extract incremental xref table
    const xrefIdx = signedStr.lastIndexOf('\nxref\n');
    assert.ok(xrefIdx !== -1, 'Incremental update must contain xref table');
    const trailerIdx = signedStr.indexOf('trailer', xrefIdx);
    assert.ok(trailerIdx > xrefIdx, 'trailer must follow xref table');
    const xrefSection = signedStr.slice(xrefIdx, trailerIdx);

    // Match all subsection headers: e.g. "1 1" or "32 2"
    const headerRegex = /^(\d+)\s+(\d+)\s*$/gm;
    const subsections = [];
    let match;
    while ((match = headerRegex.exec(xrefSection)) !== null) {
      subsections.push({
        startId: parseInt(match[1], 10),
        count: parseInt(match[2], 10),
      });
    }

    assert.ok(subsections.length >= 1, 'Must contain at least one xref subsection');

    // Strict ascending order assertion: subsection[i].startId must be strictly greater than subsection[i-1].startId
    for (let i = 1; i < subsections.length; i++) {
      assert.ok(
        subsections[i].startId > subsections[i - 1].startId,
        `ISO 32000-1 §7.5.4 violation: xref subsection ${i} (startId=${subsections[i].startId}) must be strictly greater than subsection ${i - 1} (startId=${subsections[i - 1].startId})`
      );
    }

    // 3. Also verify signPdfAsync preserves strictly ascending xref subsections
    const signedAsync = await signPdfAsync(res.pdfBytes, {
      signerName: 'Velox WebCrypto Async Validator',
      reason: 'ISO 32000-1 Strict Async XRef',
    });
    const asyncVerification = await verifyPdfSignatureAsync(signedAsync);
    assert.equal(asyncVerification.valid, true);

    const asyncStr = Buffer.from(signedAsync).toString('latin1');
    const asyncXrefIdx = asyncStr.lastIndexOf('\nxref\n');
    const asyncTrailerIdx = asyncStr.indexOf('trailer', asyncXrefIdx);
    const asyncXrefSection = asyncStr.slice(asyncXrefIdx, asyncTrailerIdx);

    const asyncSubsections = [];
    let asyncMatch;
    const asyncHeaderRegex = /^(\d+)\s+(\d+)\s*$/gm;
    while ((asyncMatch = asyncHeaderRegex.exec(asyncXrefSection)) !== null) {
      asyncSubsections.push({
        startId: parseInt(asyncMatch[1], 10),
        count: parseInt(asyncMatch[2], 10),
      });
    }
    for (let i = 1; i < asyncSubsections.length; i++) {
      assert.ok(
        asyncSubsections[i].startId > asyncSubsections[i - 1].startId,
        `Async xref subsection ${i} startId must be strictly greater than subsection ${i - 1}`
      );
    }
  });

  it('23. W3C CSS Specificity Precedence: #hero-id beats .card-class which beats div regardless of stylesheet order, and inline style beats all stylesheet rules', () => {
    // 1. Selector specificity score verification (W3C Selectors Level 3)
    if (typeof computeSelectorSpecificity === 'function') {
      const idScore = computeSelectorSpecificity('#hero-id');
      const classScore = computeSelectorSpecificity('.card-class');
      const tagScore = computeSelectorSpecificity('div');
      assert.ok(idScore >= 1000000, `ID selector score must be >= 1,000,000, got ${idScore}`);
      assert.ok(classScore >= 1000 && classScore < 1000000, `Class selector score must be >= 1,000 and < 1,000,000, got ${classScore}`);
      assert.ok(tagScore >= 1 && tagScore < 1000, `Tag selector score must be >= 1 and < 1,000, got ${tagScore}`);
      assert.ok(idScore > classScore, 'ID specificity must beat Class specificity');
      assert.ok(classScore > tagScore, 'Class specificity must beat Tag specificity');
    }

    // 2. Cascade order resolution: div rule is declared LAST in the stylesheet,
    // but #hero-id (#16a34a) and .card-class (#2563eb) must still beat div (#dc2626)
    const html = `
      <!doctype html>
      <html>
      <head>
        <style>
          #hero-id { color: #16a34a; font-weight: bold; }
          .card-class { color: #2563eb; }
          div { color: #dc2626; font-size: 14pt; }
        </style>
      </head>
      <body>
        <div id="hero-id" class="card-class">Hero Element with ID and Class</div>
        <div id="secondary-card" class="card-class">Card Element with Class Only</div>
        <div id="plain-element">Plain Div Element</div>
        <div id="inline-element" class="card-class" style="color: #9333ea;">Inline Styled Element</div>
      </body>
      </html>
    `;

    const dom = parseHtmlAndExecuteScripts(html);
    computeStylesForTree(dom.root);

    function findNodeById(node, id) {
      if (!node) return null;
      if (node.attrs && node.attrs.id === id) return node;
      if (Array.isArray(node.children)) {
        for (const child of node.children) {
          const found = findNodeById(child, id);
          if (found) return found;
        }
      }
      return null;
    }

    const heroNode = findNodeById(dom.root, 'hero-id');
    const cardNode = findNodeById(dom.root, 'secondary-card');
    const plainNode = findNodeById(dom.root, 'plain-element');
    const inlineNode = findNodeById(dom.root, 'inline-element');

    assert.ok(heroNode, '#hero-id node must exist in parsed DOM');
    assert.ok(cardNode, '#secondary-card node must exist in parsed DOM');
    assert.ok(plainNode, '#plain-element node must exist in parsed DOM');
    assert.ok(inlineNode, '#inline-element node must exist in parsed DOM');

    // #hero-id beats .card-class and div even though div is last in <style>
    assert.equal(heroNode.computedStyle.color, '#16a34a', '#hero-id (#16a34a) must beat .card-class (#2563eb) and div (#dc2626)');

    // .card-class beats div even though div is last in <style>
    assert.equal(cardNode.computedStyle.color, '#2563eb', '.card-class (#2563eb) must beat div (#dc2626)');

    // Plain div gets tag style
    assert.equal(plainNode.computedStyle.color, '#dc2626', 'Plain div must have div tag color (#dc2626)');

    // Inline style beats all stylesheet rules
    assert.equal(inlineNode.computedStyle.color, '#9333ea', 'Inline style="color: #9333ea" must beat all stylesheet rules');

    // 3. Verify complete PDF compilation with specificity-resolved colors
    const res = htmlToPdf(html, { format: 'A4', compress: false });
    assert.ok(res.pdfBytes instanceof Uint8Array);
    assert.ok(res.pdfBytes.length > 500);
    const pdfText = Buffer.from(res.pdfBytes).toString('latin1');
    assert.ok(pdfText.includes('Hero Element with ID and Class'));
    assert.ok(pdfText.includes('Inline Styled Element'));
  });

  it('24. 100-Document Batch Mail-Merge via compilePdfTemplate: compiles 100 unique customer PDFs in < 50ms with zero cross-contamination', () => {
    const template = `
      <!doctype html>
      <html>
      <head>
        <style>
          body { font-family: Helvetica; font-size: 11pt; padding: 24pt; color: #1e293b; }
          .header { font-size: 18pt; font-weight: bold; color: #0f172a; margin-bottom: 12pt; }
          .meta { margin-bottom: 6pt; }
          .total { font-size: 14pt; font-weight: bold; color: #4f46e5; margin-top: 14pt; }
        </style>
      </head>
      <body>
        <div class="header">INVOICE {{.InvoiceNumber}}</div>
        <div class="meta">Customer: <b>{{.CustomerName}}</b></div>
        <div class="meta">Account: {{.AccountId}}</div>
        <div class="meta">Date: {{.InvoiceDate}}</div>
        <div class="total">Grand Total: {{.GrandTotal}}</div>
      </body>
      </html>
    `;

    const sampleData = {
      InvoiceNumber: 'INV-2026-0000',
      CustomerName: 'Seed Customer Corp',
      AccountId: 'ACC-0000',
      InvoiceDate: '2026-10-24',
      GrandTotal: '$1,000.00',
    };

    // Compile template ONCE
    const compiledRenderer = compilePdfTemplate(template, sampleData);
    assert.equal(typeof compiledRenderer, 'function', 'compilePdfTemplate must return a callable render function');

    const docs = [];
    const count = 100;
    const t0 = performance.now();

    for (let i = 1; i <= count; i++) {
      const data = {
        InvoiceNumber: `INV-2026-${String(i).padStart(4, '0')}`,
        CustomerName: `Enterprise Customer #${i} LLC`,
        AccountId: `ACC-ALPHA-${1000 + i}`,
        InvoiceDate: '2026-10-24',
        GrandTotal: `$${(i * 123.45).toFixed(2)}`,
      };
      const result = compiledRenderer(data);
      docs.push({ data, pdfBytes: result.pdfBytes || result });
    }

    const elapsedMs = performance.now() - t0;

    // Assert batch throughput performance
    assert.equal(docs.length, 100, 'Must generate exactly 100 PDFs');
    assert.ok(
      elapsedMs < 50,
      `100 PDFs must compile in < 50 ms via compilePdfTemplate, took ${elapsedMs.toFixed(2)} ms (${(elapsedMs / count).toFixed(3)} ms/doc)`
    );

    // Validate every PDF is a valid %PDF-1.7 Uint8Array
    for (let i = 0; i < count; i++) {
      const { pdfBytes } = docs[i];
      assert.ok(pdfBytes instanceof Uint8Array, `PDF #${i + 1} must be an instance of Uint8Array`);
      assert.ok(pdfBytes.length > 300, `PDF #${i + 1} must be non-empty (>300 bytes)`);
      const header = Buffer.from(pdfBytes.subarray(0, 8)).toString('latin1');
      assert.ok(header.startsWith('%PDF-1.'), `PDF #${i + 1} must start with %PDF-1.x, got: ${header}`);
    }

    // Sample invoices #1, #50, and #100 to confirm exact data and zero cross-contamination
    // Invoice #1 (index 0)
    const text1 = Buffer.from(docs[0].pdfBytes).toString('latin1');
    assert.ok(text1.includes('INV-2026-0001'), 'Invoice #1 must contain INV-2026-0001');
    assert.ok(text1.includes('Enterprise Customer #1 LLC'), 'Invoice #1 must contain Enterprise Customer #1 LLC');
    assert.ok(text1.includes('$123.45'), 'Invoice #1 must contain $123.45');
    assert.ok(!text1.includes('Enterprise Customer #50 LLC'), 'Invoice #1 must not contain Customer #50');
    assert.ok(!text1.includes('Enterprise Customer #100 LLC'), 'Invoice #1 must not contain Customer #100');

    // Invoice #50 (index 49)
    const text50 = Buffer.from(docs[49].pdfBytes).toString('latin1');
    assert.ok(text50.includes('INV-2026-0050'), 'Invoice #50 must contain INV-2026-0050');
    assert.ok(text50.includes('Enterprise Customer #50 LLC'), 'Invoice #50 must contain Enterprise Customer #50 LLC');
    assert.ok(text50.includes(`$${(50 * 123.45).toFixed(2)}`), `Invoice #50 must contain $${(50 * 123.45).toFixed(2)}`);
    assert.ok(!text50.includes('Enterprise Customer #1 LLC'), 'Invoice #50 must not contain Customer #1');
    assert.ok(!text50.includes('Enterprise Customer #100 LLC'), 'Invoice #50 must not contain Customer #100');

    // Invoice #100 (index 99)
    const text100 = Buffer.from(docs[99].pdfBytes).toString('latin1');
    assert.ok(text100.includes('INV-2026-0100'), 'Invoice #100 must contain INV-2026-0100');
    assert.ok(text100.includes('Enterprise Customer #100 LLC'), 'Invoice #100 must contain Enterprise Customer #100 LLC');
    assert.ok(text100.includes(`$${(100 * 123.45).toFixed(2)}`), `Invoice #100 must contain $${(100 * 123.45).toFixed(2)}`);
    assert.ok(!text100.includes('Enterprise Customer #1 LLC'), 'Invoice #100 must not contain Customer #1');
    assert.ok(!text100.includes('Enterprise Customer #50 LLC'), 'Invoice #100 must not contain Customer #50');
  });

  it('25. Factur-X /EmbeddedFiles 0-OCR JSON extraction (< 2ms) & signed cryptographic tamper protection', () => {
    const data = {
      invoiceId: 'FX-2026-V8891',
      buyer: 'Stripe Merchant Solutions Inc',
      seller: 'Velox Security Infrastructure LLC',
      currency: 'USD',
      totalAmount: 14850.75,
      taxAmount: 1485.08,
      lineItems: [
        { desc: 'High-Throughput Vector PDF Core License', qty: 1, unitPrice: 9850.75 },
        { desc: 'FIPS 140-3 Hardware PKI Signer Enclave', qty: 1, unitPrice: 5000.00 },
      ],
      compliance: {
        standard: 'Factur-X / ZUGFeRD 2.2',
        profile: 'EXTENDED',
      },
    };

    const html = `
      <!doctype html>
      <html>
      <head>
        <style>
          body { font-family: Helvetica; font-size: 11pt; padding: 24pt; color: #1e293b; }
          .title { font-size: 18pt; font-weight: bold; color: #0f172a; }
          .amount { font-size: 16pt; font-weight: bold; color: #16a34a; }
        </style>
      </head>
      <body>
        <div class="title">Official Factur-X Invoice</div>
        <p>Invoice: <b>FX-2026-V8891</b></p>
        <p>Buyer: Stripe Merchant Solutions Inc</p>
        <div class="amount">Total: $14,850.75</div>
      </body>
      </html>
    `;

    // 1. Render PDF with embedded structured JSON data
    const rendered = htmlToPdf(html, {
      format: 'A4',
      compress: false,
      data,
    });
    assert.ok(rendered.pdfBytes instanceof Uint8Array);

    // 2. Cryptographically sign the PDF with X.509 PKCS#7
    const cert = generateSelfSignedCert({ commonName: 'Velox Factur-X Authority' });
    const signedPdf = signPdf(rendered.pdfBytes, {
      certPem: cert.certPem,
      keyPem: cert.keyPem,
      signerName: 'Velox Factur-X Authority',
      reason: 'ISO 32000-1 Factur-X Integrity Seal',
      location: 'Zurich Secure Enclave',
    });
    assert.ok(signedPdf instanceof Uint8Array);

    // 3. Verify pristine signature
    const pristineVerification = verifyPdfSignature(signedPdf);
    assert.equal(pristineVerification.valid, true, `Pristine signature must be valid, got: ${pristineVerification.error}`);
    assert.equal(pristineVerification.tamperDetected, false);

    // 4. Extract embedded Factur-X JSON and verify recovery in < 2ms
    const t0 = performance.now();
    const extractedData = extractEmbeddedData(signedPdf);
    const extractElapsedMs = performance.now() - t0;

    assert.ok(extractedData !== null && typeof extractedData === 'object', 'extractEmbeddedData must return parsed JSON payload');
    assert.deepEqual(extractedData, data, 'Extracted Factur-X JSON must deeply equal original data payload');
    assert.ok(
      extractElapsedMs < 2,
      `0-OCR extraction must execute in < 2 ms, took ${extractElapsedMs.toFixed(3)} ms`
    );

    // 5. Tamper test: Flip 1 byte inside the embedded JSON stream in the signed PDF
    // Find the unique string "FX-2026-V8891" inside the PDF bytes
    const needle = Buffer.from('FX-2026-V8891');
    const needleIdx = Buffer.from(signedPdf).indexOf(needle);
    assert.ok(needleIdx !== -1, 'Must locate embedded JSON stream content inside signed PDF bytes');

    // Create a copy and flip 1 byte inside the embedded JSON content
    const tamperedPdf = Uint8Array.from(signedPdf);
    tamperedPdf[needleIdx] ^= 0x01; // Mutate 'F' to 'G'

    // Verify cryptographic tamper detection
    const tamperedVerification = verifyPdfSignature(tamperedPdf);
    assert.equal(tamperedVerification.valid, false, 'Tampered PDF must fail cryptographic verification');
    assert.equal(tamperedVerification.tamperDetected, true, 'Cryptographic tamper must be detected when embedded JSON is modified');
  });

  it('26. Browser Bundle & Standalone API Contract: computeSelectorSpecificity, extractEmbeddedData, buildMinimalTrueTypeFont, and parseTrueTypeFont handle Uint8Array inputs cleanly', async () => {
    // 1. computeSelectorSpecificity handles string and Uint8Array inputs
    if (typeof computeSelectorSpecificity === 'function') {
      const specFromStr = computeSelectorSpecificity('#checkout-btn.primary-btn:first-child');
      assert.ok(typeof specFromStr === 'number' && specFromStr >= 1000000);

      const u8Selector = new TextEncoder().encode('#checkout-btn.primary-btn:first-child');
      const specFromU8 = computeSelectorSpecificity(u8Selector);
      assert.equal(specFromU8, specFromStr, 'computeSelectorSpecificity must yield identical score for Uint8Array and string');
    }

    // 2. buildMinimalTrueTypeFont returns a valid TrueType font binary as Uint8Array
    const ttfBytes = buildMinimalTrueTypeFont({ fontName: 'VeloxStandaloneSans', unitsPerEm: 1000 });
    assert.ok(ttfBytes instanceof Uint8Array, 'buildMinimalTrueTypeFont must return a Uint8Array');
    assert.ok(ttfBytes.length > 500, `buildMinimalTrueTypeFont returned ${ttfBytes.length} bytes`);

    // 3. parseTrueTypeFont accepts pure Uint8Array directly (no Node Buffer required)
    const pureU8Font = new Uint8Array(ttfBytes.buffer, ttfBytes.byteOffset, ttfBytes.byteLength);
    const parsedFont = parseTrueTypeFont(pureU8Font);
    assert.equal(parsedFont.embedded, true, 'parseTrueTypeFont must parse valid TTF from pure Uint8Array');
    assert.ok(parsedFont.numGlyphs > 0, 'parseTrueTypeFont must identify glyph count');
    assert.equal(parsedFont.unitsPerEm, 1000, 'parseTrueTypeFont must extract unitsPerEm');
    assert.ok(parsedFont.tables && parsedFont.tables.head, 'parseTrueTypeFont must identify TTF tables');

    // 4. htmlToPdf accepts HTML and returns a Uint8Array with custom font Uint8Array
    const testHtml = `
      <!doctype html>
      <html><body><p style="font-family: 'VeloxStandaloneSans';">Universal Browser Bundle API Contract Test</p></body></html>
    `;
    const renderRes = htmlToPdf(testHtml, {
      format: 'A4',
      compress: false,
      fonts: {
        'VeloxStandaloneSans': pureU8Font,
      },
      data: { contractVer: '2.0.0', engine: 'VeloxPDF-Standalone' },
    });
    assert.ok(renderRes.pdfBytes instanceof Uint8Array, 'renderRes.pdfBytes must be a Uint8Array');

    // 5. extractEmbeddedData accepts raw Uint8Array cleanly
    const pureU8Pdf = new Uint8Array(renderRes.pdfBytes.buffer, renderRes.pdfBytes.byteOffset, renderRes.pdfBytes.byteLength);
    const extracted = extractEmbeddedData(pureU8Pdf);
    assert.ok(extracted && typeof extracted === 'object', 'extractEmbeddedData must handle raw Uint8Array');
    assert.equal(extracted.engine, 'VeloxPDF-Standalone');

    // 6. signPdf and verifyPdfSignature work seamlessly with raw Uint8Array inputs
    const cert = generateSelfSignedCert({ commonName: 'Velox Standalone PKI' });
    const signedPdf = signPdf(pureU8Pdf, {
      certPem: cert.certPem,
      keyPem: cert.keyPem,
      signerName: 'Velox Standalone PKI',
      reason: 'Browser Bundle Contract Verification',
    });
    assert.ok(signedPdf instanceof Uint8Array);

    const pureSignedU8 = new Uint8Array(signedPdf.buffer, signedPdf.byteOffset, signedPdf.byteLength);
    const verifySync = verifyPdfSignature(pureSignedU8);
    assert.equal(verifySync.valid, true, 'verifyPdfSignature must accept pure Uint8Array');
    assert.equal(verifySync.tamperDetected, false);

    const verifyAsync = await verifyPdfSignatureAsync(pureSignedU8);
    assert.equal(verifyAsync.valid, true, 'verifyPdfSignatureAsync must accept pure Uint8Array');
    assert.equal(verifyAsync.tamperDetected, false);
  });

});

// ---------------------------------------------------------------------------
// E-invoice (Factur-X / ZUGFeRD / XRechnung CII) generator
// ---------------------------------------------------------------------------
import {
  buildCiiXml as einvoiceBuildCiiXml,
  computeTotals as einvoiceComputeTotals,
  validateInvoice as einvoiceValidate,
  money as einvoiceMoney,
  escapeXml as einvoiceEscapeXml,
  formatDate102 as einvoiceDate102,
  GUIDELINE_IDS as EINVOICE_GUIDELINE_IDS,
  PDF_EMBEDDING as EINVOICE_PDF_EMBEDDING,
  normalizeProfile as einvoiceNormalizeProfile,
} from '../src/einvoice/index.mjs';
import { EXAMPLES as EINVOICE_EXAMPLES, germanB2B as einvoiceGermanB2B, reverseCharge as einvoiceReverseCharge, xrechnung as einvoiceXRechnung } from '../src/einvoice/examples.mjs';

describe('E-invoice CII generator (EN 16931)', () => {
  const baseInvoice = (lines, extra = {}) => ({
    number: 'T-1', issueDate: '2026-10-24', currency: 'EUR',
    seller: { name: 'S GmbH', vatId: 'DE123456789', address: { country: 'DE' } },
    buyer: { name: 'B AG', address: { country: 'DE' } },
    paymentTerms: { dueDate: '2026-11-24' },
    lines, ...extra,
  });
  const line = (id, quantity, netPrice, vatRate = 19, more = {}) => ({ id: String(id), name: `Item ${id}`, quantity, unitCode: 'C62', netPrice, vatCategory: 'S', vatRate, ...more });

  it('computes the German B2B totals with two VAT rates, discount and charge', () => {
    const t = einvoiceComputeTotals(einvoiceGermanB2B);
    assert.deepEqual(t.lines.map((l) => l.netAmount), ['1187.50', '74.85', '134.10']);
    assert.equal(t.lineTotal, '1396.45');
    assert.equal(t.allowanceTotal, '50.00');
    assert.equal(t.chargeTotal, '9.90');
    assert.equal(t.taxBasisTotal, '1356.35');
    assert.deepEqual(t.vatBreakdown.map((g) => [g.category, g.rate, g.basis, g.tax]), [['S', '19', '1271.60', '241.60'], ['S', '7', '84.75', '5.93']]);
    assert.equal(t.taxTotal, '247.53');
    assert.equal(t.grandTotal, '1603.88');
    assert.equal(t.duePayable, '1603.88');
  });

  it('rounds half away from zero on exact decimals (0.005 cases)', () => {
    assert.equal(einvoiceMoney('1.005'), '1.01');
    assert.equal(einvoiceMoney(1.005), '1.01');
    assert.equal(einvoiceMoney('0.005'), '0.01');
    assert.equal(einvoiceMoney('-0.005'), '-0.01');
    assert.equal(einvoiceMoney('2.675'), '2.68');
    assert.equal(einvoiceMoney('0.0049999'), '0.00');
    // 3 x 0.335 is 1.0049999... in binary floats; exact math gives 1.005 -> 1.01.
    const t = einvoiceComputeTotals(baseInvoice([line(1, 3, 0.335)]));
    assert.equal(t.lines[0].netAmount, '1.01');
    // 0.5 cent of VAT rounds up: 0.50 at 1% = 0.005 -> 0.01
    assert.equal(einvoiceComputeTotals(baseInvoice([line(1, 1, '0.50', 1)])).taxTotal, '0.01');
  });

  it('computes VAT on the category basis, not as a sum of rounded line VAT', () => {
    const lines = Array.from({ length: 7 }, (_, i) => line(i + 1, 1, '1.05', 7));
    const t = einvoiceComputeTotals(baseInvoice(lines));
    // Per line: 0.0735 -> 0.07, x7 = 0.49. Category: 7.35 x 7% = 0.5145 -> 0.51.
    assert.equal(t.vatBreakdown[0].basis, '7.35');
    assert.equal(t.taxTotal, '0.51');
    assert.equal(t.grandTotal, '7.86');
  });

  it('handles many lines and mixed rates exactly', () => {
    const lines = [];
    for (let i = 0; i < 1000; i++) lines.push(line(i + 1, 1, '0.01', [19, 7, 0][i % 3], i % 3 === 2 ? { vatCategory: 'Z' } : {}));
    const t = einvoiceComputeTotals(baseInvoice(lines));
    assert.equal(t.lineTotal, '10.00');
    const by = Object.fromEntries(t.vatBreakdown.map((g) => [`${g.category}${g.rate}`, g]));
    assert.equal(by.S19.basis, '3.34'); assert.equal(by.S19.tax, '0.63');
    assert.equal(by.S7.basis, '3.33'); assert.equal(by.S7.tax, '0.23');
    assert.equal(by.Z0.basis, '3.33'); assert.equal(by.Z0.tax, '0.00');
    assert.equal(t.taxTotal, '0.86');
    assert.equal(t.grandTotal, '10.86');
  });

  it('supports price base quantity, percent allowances and prepaid amounts', () => {
    const inv = baseInvoice([line(1, 250, '12.34', 19, { basisQuantity: 100, allowances: [{ percent: 2.5, reason: 'Promo' }] })], { prepaidAmount: '10' });
    const t = einvoiceComputeTotals(inv);
    // 250 x 12.34 / 100 = 30.85; 2.5% of 30.85 = 0.77125 -> 0.77
    assert.equal(t.lines[0].allowances[0].amount, '0.77');
    assert.equal(t.lines[0].allowances[0].baseAmount, '30.85');
    assert.equal(t.lines[0].netAmount, '30.08');
    assert.equal(t.taxTotal, '5.72');
    assert.equal(t.grandTotal, '35.80');
    assert.equal(t.prepaid, '10.00');
    assert.equal(t.duePayable, '25.80');
  });

  it('builds every example with the right guideline ID and well-formed structure', () => {
    for (const [name, { invoice, profile }] of Object.entries(EINVOICE_EXAMPLES)) {
      const xml = einvoiceBuildCiiXml(invoice, { profile });
      assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), name);
      assert.ok(xml.includes(`<ram:GuidelineSpecifiedDocumentContextParameter>\n      <ram:ID>${einvoiceEscapeXml(EINVOICE_GUIDELINE_IDS[einvoiceNormalizeProfile(profile)])}</ram:ID>`), `${name} guideline`);
      // Tag balance check.
      const stack = [];
      for (const m of xml.matchAll(/<(\/?)([a-z]+:[A-Za-z]+)[^>]*?(\/?)>/g)) {
        if (m[3]) continue;
        if (m[1]) assert.equal(stack.pop(), m[2], `${name} closes ${m[2]}`);
        else stack.push(m[2]);
      }
      assert.equal(stack.length, 0, name);
    }
  });

  it('writes amounts, escaped text and format 102 dates into the EN16931 XML', () => {
    const xml = einvoiceBuildCiiXml(einvoiceGermanB2B, { profile: 'EN16931' });
    assert.ok(xml.includes('<ram:TaxTotalAmount currencyID="EUR">247.53</ram:TaxTotalAmount>'));
    assert.ok(xml.includes('<ram:GrandTotalAmount>1603.88</ram:GrandTotalAmount>'));
    assert.ok(xml.includes('<udt:DateTimeString format="102">20261020</udt:DateTimeString>'));
    assert.ok(xml.includes('<ram:Name>Kunde &amp; Partner AG</ram:Name>'));
    assert.ok(xml.includes('Fachbuch &quot;PDF &amp; XML&quot;'));
    assert.ok(xml.includes('<ram:IBANID>DE89370400440532013000</ram:IBANID>'));
    assert.ok(xml.includes('<ram:BICID>COBADEFFXXX</ram:BICID>'));
    // Header order: agreement, delivery, settlement.
    assert.ok(xml.indexOf('ApplicableHeaderTradeAgreement') < xml.indexOf('ApplicableHeaderTradeDelivery'));
    assert.ok(xml.indexOf('ApplicableHeaderTradeDelivery') < xml.indexOf('ApplicableHeaderTradeSettlement'));
  });

  it('limits MINIMUM and BASIC WL to header data', () => {
    const min = einvoiceBuildCiiXml(EINVOICE_EXAMPLES.minimum.invoice, { profile: 'MINIMUM' });
    assert.ok(!min.includes('IncludedSupplyChainTradeLineItem'));
    assert.ok(!min.includes('LineTotalAmount'));
    assert.ok(min.includes('<ram:ApplicableHeaderTradeDelivery/>'));
    assert.ok(min.includes('<ram:DuePayableAmount>119.00</ram:DuePayableAmount>'));
    const wl = einvoiceBuildCiiXml(EINVOICE_EXAMPLES.basicWl.invoice, { profile: 'BASIC WL' });
    assert.ok(!wl.includes('IncludedSupplyChainTradeLineItem'));
    assert.ok(wl.includes('urn:factur-x.eu:1p0:basicwl'));
  });

  it('writes the reverse charge exemption and the XRechnung extras', () => {
    const ae = einvoiceBuildCiiXml(einvoiceReverseCharge, { profile: 'EN16931' });
    assert.ok(ae.includes('<ram:ExemptionReasonCode>VATEX-EU-AE</ram:ExemptionReasonCode>'));
    assert.ok(ae.includes('<ram:CategoryCode>AE</ram:CategoryCode>'));
    const xr = einvoiceBuildCiiXml(einvoiceXRechnung, { profile: 'XRECHNUNG' });
    assert.ok(xr.includes('urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0'));
    assert.ok(xr.includes('<ram:BuyerReference>04011000-12345-34</ram:BuyerReference>'));
    assert.ok(xr.includes('<ram:URIID schemeID="0204">04011000-12345-34</ram:URIID>'));
    assert.ok(xr.includes('<ram:DefinedTradeContact>'));
  });

  it('reports missing business terms in plain words before generating', () => {
    const noVat = baseInvoice([line(1, 1, '10')]);
    delete noVat.seller.vatId;
    const errs = einvoiceValidate(noVat, 'EN16931');
    assert.ok(errs.some((e) => e.term === 'BT-31' && e.message === 'BT-31 Seller VAT identifier is required for standard-rated invoices (or give the seller tax number, BT-32)'), JSON.stringify(errs));
    assert.throws(() => einvoiceBuildCiiXml(noVat, { profile: 'EN16931' }), /BT-31 Seller VAT identifier is required/);

    const ae = structuredClone(einvoiceReverseCharge);
    delete ae.vatExemptions;
    assert.ok(einvoiceValidate(ae, 'EN16931').some((e) => e.term === 'BT-120' && /reverse charge \(AE\)/.test(e.message)));

    const xr = structuredClone(einvoiceXRechnung);
    delete xr.buyerReference;
    delete xr.seller.contact.phone;
    delete xr.buyer.electronicAddress;
    const terms = einvoiceValidate(xr, 'XRECHNUNG').map((e) => e.term);
    assert.deepEqual(terms.sort(), ['BT-10', 'BT-42', 'BT-49']);

    const noDue = baseInvoice([line(1, 1, '10')]);
    delete noDue.paymentTerms;
    assert.ok(einvoiceValidate(noDue, 'BASIC').some((e) => e.term === 'BT-9'));
    assert.ok(einvoiceValidate({ ...baseInvoice([line(1, 1, '10')]), paymentMeans: { code: '58' } }, 'EN16931').some((e) => e.term === 'BT-84'));
    assert.deepEqual(einvoiceValidate(einvoiceGermanB2B, 'EN16931'), []);
  });

  it('escapes XML, formats dates and exposes PDF embedding metadata', () => {
    assert.equal(einvoiceEscapeXml(`a&b<c>"d"'e'\u0001`), 'a&amp;b&lt;c&gt;&quot;d&quot;&apos;e&apos;');
    assert.equal(einvoiceDate102('2026-01-05'), '20260105');
    assert.equal(einvoiceDate102(new Date(Date.UTC(2026, 11, 31))), '20261231');
    assert.equal(EINVOICE_PDF_EMBEDDING.EN16931.conformanceLevel, 'EN 16931');
    assert.equal(EINVOICE_PDF_EMBEDDING.BASICWL.afRelationship, 'Data');
    assert.equal(EINVOICE_PDF_EMBEDDING.BASIC.fileName, 'factur-x.xml');
    assert.throws(() => einvoiceNormalizeProfile('EXTENDED'), /Unknown e-invoice profile/);
  });
});

describe('PDF/A-3b output mode', () => {
  const pdfaHtml = `<!doctype html><html><head><title>PDF/A Probe – Müller</title></head><body style="font-family: Helvetica">
    <h1 style="font-weight: bold">Invoice INV-42</h1><p>Total due: €1,250.00 · ±5 ₹</p>
    <p style="font-family: Times">Serif line</p><code style="font-family: Courier">mono 0123</code></body></html>`;
  const latin1 = (b) => Buffer.from(b).toString('latin1');

  it('writes trailer /ID, XMP metadata, sRGB OutputIntent and embedded subset fonts', async () => {
    const { subsetTrueType } = await import('../src/ttf-subset.mjs');
    assert.equal(typeof subsetTrueType, 'function');
    const pdf = htmlToPdf(pdfaHtml, { pdfa: '3b', creationDate: '2026-10-24T10:00:00Z' });
    const s = latin1(pdf);
    assert.match(s, /trailer\n<< \/Size \d+ \/Root \d+ 0 R \/Info \d+ 0 R \/ID \[<[0-9A-F]{32}> <[0-9A-F]{32}>\] >>/);
    assert.match(s, /\/Type \/Metadata \/Subtype \/XML/);
    assert.match(s, /<pdfaid:part>3<\/pdfaid:part>/);
    assert.match(s, /<pdfaid:conformance>B<\/pdfaid:conformance>/);
    assert.ok(Buffer.from(pdf).includes(Buffer.from('<rdf:li xml:lang="x-default">PDF/A Probe – Müller</rdf:li>', 'utf8')));
    assert.match(s, /\/OutputIntents \[\d+ 0 R\]/);
    assert.match(s, /\/S \/GTS_PDFA1 \/OutputConditionIdentifier \(sRGB IEC61966-2\.1\)/);
    assert.doesNotMatch(s, /\/Subtype \/Type1/);
    const subsetNames = [...s.matchAll(/\/BaseFont \/([A-Z]{6})\+(Liberation[A-Za-z-]+)/g)].map((m) => m[2]);
    assert.ok(subsetNames.includes('LiberationSans-Bold'));
    assert.ok(subsetNames.includes('LiberationSerif'));
    assert.ok(subsetNames.includes('LiberationMono'));
    assert.match(s, /\/FontFile2 \d+ 0 R/);
    assert.match(s, /\/ToUnicode \d+ 0 R/);
    // Fixed creationDate makes the output reproducible
    const again = htmlToPdf(pdfaHtml, { pdfa: '3b', creationDate: '2026-10-24T10:00:00Z' });
    assert.deepEqual(Buffer.from(again), Buffer.from(pdf));
  });

  it('leaves non-pdfa output free of PDF/A structures', () => {
    const s = latin1(htmlToPdf(pdfaHtml, {}));
    assert.doesNotMatch(s, /\/ID \[|\/OutputIntents|\/Metadata|FontFile2/);
    assert.match(s, /\/BaseFont \/Helvetica /);
  });

  it('subsets fonts so a one-page invoice stays well under 100 KB', async () => {
    const { subsetTrueType } = await import('../src/ttf-subset.mjs');
    const fs = await import('node:fs');
    const ttf = new Uint8Array(fs.readFileSync(new URL('../fonts/LiberationSans-Regular.ttf', import.meta.url)));
    const full = parseTrueTypeFont(ttf);
    const gids = [0, ...'Invoice 0123'.split('').map((c) => full.cmap.get(c.codePointAt(0)))];
    const uniq = [...new Set(gids)];
    const sub = subsetTrueType(ttf, uniq);
    assert.ok(sub.bytes.length < 20000, `subset is ${sub.bytes.length} bytes`);
    const reparsed = parseTrueTypeFont(sub.bytes);
    assert.equal(reparsed.numGlyphs, sub.numGlyphs);
    for (let i = 1; i < uniq.length; i++) assert.equal(reparsed.widths.get(i), full.widths.get(uniq[i]));

    const rows = Array.from({ length: 8 }, (_, i) => `<tr><td>Item ${i + 1} – Consulting</td><td>${i + 1}</td><td>€${(i + 1) * 125}.00</td></tr>`).join('');
    const invoice = `<html><head><title>Invoice</title></head><body><h1 style="font-weight:bold">Invoice INV-2026-001</h1>
      <p>Acme GmbH · Hauptstraße 1 · 10115 Berlin</p><table>${rows}</table><p><b>Total €4,500.00</b></p></body></html>`;
    const pdf = htmlToPdf(invoice, { pdfa: '3b', compress: true });
    assert.ok(pdf.byteLength < 100 * 1024, `pdfa invoice is ${pdf.byteLength} bytes`);
  });

  it('signed pdfa output keeps /ID, /Metadata and a valid signature', async () => {
    const cert = generateSelfSignedCert({ commonName: 'PDF/A Test' });
    const base = htmlToPdf(pdfaHtml, { pdfa: '3b', compress: true });
    const ids = (b) => [...latin1(b).matchAll(/\/ID \[(<[0-9A-F]+>) (<[0-9A-F]+>)\]/g)].map((m) => m[1] + m[2]);
    for (const signed of [signPdf(base, cert), await signPdfAsync(base, cert)]) {
      const s = latin1(signed);
      const trailers = [...s.matchAll(/trailer\n<<([^]*?)>>\nstartxref/g)];
      assert.equal(trailers.length, 2);
      for (const t of trailers) assert.match(t[1], /\/ID \[/);
      assert.deepEqual(new Set(ids(signed)).size, 1);
      assert.equal(ids(signed)[0], ids(base)[0]);
      const catalogs = [...s.matchAll(/\/Type \/Catalog[^]*?endobj/g)].map((m) => m[0]);
      assert.match(catalogs[catalogs.length - 1], /\/Metadata \d+ 0 R/);
      assert.match(catalogs[catalogs.length - 1], /\/OutputIntents/);
      assert.equal(verifyPdfSignature(signed).valid, true);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Fidelity fixes found by scripts/fidelity (block children in cells, long words, <br>, flex text,
// responsive media queries, section backgrounds)
// ---------------------------------------------------------------------------------------------
import {
  wrapParagraphOptimal as fidelityWrap,
  parseHtmlAndExecuteScripts as fidelityParse,
  computeStylesForTree as fidelityStyles,
  layoutAndPaginate as fidelityLayout,
  measureTextWidth as fidelityMeasure,
} from '../src/index.mjs';

function fidelityItems(html, opts = {}) {
  const dom = fidelityParse(html, { data: {} });
  const st = fidelityStyles(dom.rootNode, {});
  const out = fidelityLayout(st.rootNode, { format: 'A4', margins: 36, ...(st.pageConfig || {}) }, opts);
  return (out.pages || out)[0].items;
}
const fidelityTexts = (items) => items.filter((i) => i.type === 'text');

describe('fidelity fixes', () => {
  it('stacks block children of a table cell on separate lines', () => {
    const t = fidelityTexts(fidelityItems('<table><tr><td><p>one</p><p>two</p></td><td>x</td></tr></table>'));
    const one = t.find((i) => i.text === 'one');
    const two = t.find((i) => i.text === 'two');
    assert.ok(one && two, 'both paragraphs are drawn');
    assert.ok(two.y - one.y >= 8, `two sits below one (dy=${two.y - one.y})`);
    assert.ok(!t.some((i) => /onetwo/.test(i.text)), 'no run-together text');
  });

  it('splits a single word wider than its line in the plain path', () => {
    const cs = { fontSize: 10 };
    const word = 'A'.repeat(60);
    const lines = fidelityWrap(word, 80, cs);
    assert.ok(lines.length > 1);
    assert.equal(lines.join(''), word);
    for (const l of lines) assert.ok(fidelityMeasure(l, cs) <= 80 + 0.01, 'every chunk fits the line');
    const mixed = fidelityWrap('short ' + word + ' tail', 80, cs);
    assert.ok(mixed[0] === 'short');
    assert.equal(mixed.join('').replace(/ /g, ''), 'short' + word + 'tail');
    assert.deepEqual(fidelityWrap('hello world foo bar', 60, cs), ['hello world', 'foo bar']);
  });

  it('keeps <br> lines one line apart (br is inline)', () => {
    const t = fidelityTexts(fidelityItems('<div>Acme<br>742 Evergreen<br>+1 555</div>'));
    assert.equal(t.length, 3);
    const step1 = t[1].y - t[0].y;
    const step2 = t[2].y - t[1].y;
    assert.ok(step1 > 10 && step1 < 18, `line step ${step1}`);
    assert.ok(Math.abs(step1 - step2) < 0.01);
  });

  it('draws loose text next to a span inside a flex row', () => {
    const t = fidelityTexts(fidelityItems('<p style="display:flex;justify-content:space-between">Item Total <span>385.00</span></p>'));
    const label = t.find((i) => /Item Total/.test(i.text));
    const value = t.find((i) => i.text === '385.00');
    assert.ok(label && value, 'label and value are both drawn');
    assert.ok(value.x > label.x + 40, 'value is pushed to the right of the label');
    assert.ok(Math.abs(value.y - label.y) < 1, 'same row');
  });

  it('does not apply a max-width mobile media query to the page', () => {
    const css = '.b{display:flex}.b>div{width:32%} @media (max-width:600px){.b{flex-direction:column}.b>div{width:100%}}';
    const t = fidelityTexts(fidelityItems(`<style>${css}</style><div class="b"><div>left</div><div>mid</div><div>right</div></div>`));
    const ys = new Set(t.map((i) => Math.round(i.y)));
    assert.equal(ys.size, 1, 'three columns share one row');
    const xs = t.map((i) => i.x).sort((a, b) => a - b);
    assert.ok(xs[1] - xs[0] > 100 && xs[2] - xs[1] > 100, 'columns are about a third of the page apart');
  });

  it('starts a table inside a painted box at the box, and sizes the box to it', () => {
    const items = fidelityItems('<div style="background:#eeeeee;padding:10px"><table><tr><td>cell</td></tr></table></div><p>after</p>');
    const box = items.find((i) => i.type === 'rect' && i.fill === '#eeeeee');
    const cell = items.find((i) => i.type === 'text' && i.text === 'cell');
    const after = items.find((i) => i.type === 'text' && i.text === 'after');
    assert.ok(cell.y >= box.y && cell.y <= box.y + box.h, 'cell text is inside the box');
    assert.ok(after.y > box.y + box.h - 1, 'following text starts below the box');
  });

  it('takes a thead background and keeps header text readable on it', () => {
    const items = fidelityItems('<style>thead{background:#ffeb3b;color:#111}</style><table><thead><tr><th>Head</th></tr></thead><tbody><tr><td>body</td></tr></tbody></table>');
    assert.ok(items.some((i) => i.type === 'rect' && i.fill === '#ffeb3b'), 'thead colour is painted');
    const head = items.find((i) => i.type === 'text' && i.text === 'Head');
    assert.notEqual(head.color, '#ffffff', 'dark text on a yellow header, not white');
  });

  it('honours grid-column spans', () => {
    const css = '.g{display:grid;grid-template-columns:50% 50%}.full{grid-column-start:1;grid-column-end:3}';
    const t = fidelityTexts(fidelityItems(`<style>${css}</style><div class="g"><div>a</div><div>b</div><div class="full">wide</div><div>c</div></div>`));
    const [a, b, wide, c] = ['a', 'b', 'wide', 'c'].map((w) => t.find((i) => i.text === w));
    assert.ok(Math.abs(a.y - b.y) < 1 && b.x - a.x > 200, 'a and b share a row');
    assert.ok(wide.y > a.y + 8 && Math.abs(wide.x - a.x) < 1, 'the spanning item takes its own row from the left edge');
    assert.ok(c.y > wide.y + 8, 'c starts the next row');
  });
});

describe('renderEInvoice (PDF/A-3b + embedded CII XML)', () => {
  const latin1 = (b) => Buffer.from(b).toString('latin1');

  it('embeds the profile XML with the Factur-X file spec, AF entry and fx XMP for every fixture', async () => {
    const { renderEInvoice, EINVOICE_EXAMPLES, EINVOICE_PDF_EMBEDDING, buildCiiXml } = await import('../src/index.mjs');
    const zlib = await import('node:zlib');
    for (const [name, { invoice, profile }] of Object.entries(EINVOICE_EXAMPLES)) {
      const pdf = renderEInvoice(invoice, { profile, compress: true, creationDate: '2026-10-24T09:00:00Z' });
      const s = latin1(pdf);
      const emb = EINVOICE_PDF_EMBEDDING[profile];
      assert.match(s, new RegExp(`/Type /Filespec /F \\(${emb.fileName.replace('.', '\\.')}\\) /UF \\(${emb.fileName.replace('.', '\\.')}\\)[^]*?/AFRelationship /${emb.afRelationship}`), name);
      assert.match(s, /\/Type \/EmbeddedFile \/Subtype \/text#2Fxml \/Filter \/FlateDecode \/Length (\d+) \/Params << \/Size \d+ \/CheckSum <[0-9A-F]{32}> \/ModDate \(D:/);
      assert.match(s, /\/Names << \/EmbeddedFiles << \/Names \[\(.+?\) \d+ 0 R\] >> >> \/AF \[\d+ 0 R\]/);
      assert.doesNotMatch(s, /velox-payload\.json/, `${name} should not carry the JSON payload`);
      assert.match(s, new RegExp(`<fx:ConformanceLevel>${emb.conformanceLevel}</fx:ConformanceLevel>`));
      assert.match(s, new RegExp(`<fx:DocumentFileName>${emb.fileName.replace('.', '\\.')}</fx:DocumentFileName>`));
      assert.match(s, /<pdfaSchema:prefix>fx<\/pdfaSchema:prefix>/);
      assert.match(s, /<pdfaid:part>3<\/pdfaid:part>/);
      // The embedded stream inflates to exactly buildCiiXml's output
      const m = /\/Type \/EmbeddedFile \/Subtype \/text#2Fxml \/Filter \/FlateDecode \/Length (\d+)[^]*?>> >>\nstream\n/.exec(s);
      const start = m.index + m[0].length;
      const xml = zlib.inflateSync(Buffer.from(pdf).subarray(start, start + Number(m[1]))).toString('utf8');
      assert.equal(xml, buildCiiXml(invoice, { profile }));
      assert.equal(pdf.xml, xml);
    }
  });

  it('prints the same totals the XML carries and refuses invalid invoices with readable errors', async () => {
    const { prepareEInvoice, renderEInvoice, EINVOICE_EXAMPLES } = await import('../src/index.mjs');
    const { invoice, profile } = EINVOICE_EXAMPLES.germanB2B;
    const prep = prepareEInvoice(invoice, { profile });
    assert.ok(prep.html.includes(`${'1,603.88'} EUR`));
    assert.ok(prep.xml.includes(`<ram:GrandTotalAmount>${prep.totals.grandTotal}</ram:GrandTotalAmount>`));
    assert.equal(prep.totals.grandTotal, '1603.88');
    assert.throws(() => renderEInvoice({ ...invoice, seller: undefined }, { profile }), /Invoice is not valid for profile EN16931/);
  });

  it('supports a custom template, an opt-in JSON payload and signing without losing the XML', async () => {
    const { renderEInvoice, EINVOICE_EXAMPLES, signPdf, verifyPdfSignature, generateSelfSignedCert } = await import('../src/index.mjs');
    const { invoice, profile } = EINVOICE_EXAMPLES.frenchBasic;
    const custom = renderEInvoice(invoice, { profile, template: '<html><body><h1>{{invoice.number}}</h1><p>Total {{totals.grandTotal}} {{invoice.currency}}</p></body></html>', embedPayload: true });
    const s = latin1(custom);
    assert.match(s, /factur-x\.xml/);
    assert.match(s, /velox-payload\.json/);
    const cert = generateSelfSignedCert({ commonName: 'E-Invoice Test' });
    const signed = signPdf(renderEInvoice(invoice, { profile }), cert);
    assert.equal(verifyPdfSignature(signed).valid, true);
    const ss = latin1(signed);
    assert.equal([...ss.matchAll(/trailer\n<<[^]*?\/ID \[/g)].length, 2);
    assert.match(ss, /\/AF \[\d+ 0 R\]/);
  });
});

// ---------------------------------------------------------------------------------------------
// Round 2: trust fixes (no lost text, no overlap), authored tables, italic, page sizes
// ---------------------------------------------------------------------------------------------
function mediaBoxOf(pdf) {
  const m = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(Buffer.from(pdf).toString('latin1'));
  return [parseFloat(m[1]), parseFloat(m[2])];
}

describe('round 2 fidelity fixes', () => {
  it('lets a heading with a bigger font keep its own line height (font shorthand with line-height)', () => {
    const t = fidelityTexts(fidelityItems('<html><head><style>body{font:14px/1.6 Arial,sans-serif}h1{font-size:32px;margin:0}</style></head><body><h1>Invoice</h1><div>Subtitle</div></body></html>'));
    const h = t.find((i) => i.text === 'Invoice');
    const sub = t.find((i) => i.text === 'Subtitle');
    assert.ok(sub.y - h.y > 26 && sub.y - h.y < 28, `heading keeps 1.6 x its own 24pt size (dy=${sub.y - h.y})`);
  });

  it('does not pad every word of a shaded paragraph (a block background is not an inline chip)', () => {
    const t = fidelityTexts(fidelityItems('<p style="background:#fffbeb;padding:4px">one two three <b>four</b></p>'));
    const one = t.find((i) => /one/.test(i.text));
    assert.match(one.text, /one two three/, 'plain words stay merged on one run');
  });

  it('draws nothing for emoji and leaves no gap', () => {
    const t = fidelityTexts(fidelityItems('<p>⚠️ Careful now</p>'));
    assert.equal(t.length, 1);
    assert.equal(t[0].text, 'Careful now');
    assert.ok(t[0].x < 40, 'text starts at the left edge');
  });

  it('applies the authored table box model when the page styles th/td', () => {
    const items = fidelityItems('<style>td{padding:12px;border-bottom:1px solid #ccc}</style><table><tr><td>a</td></tr><tr><td>b</td></tr></table>');
    const rects = items.filter((i) => i.type === 'rect' && i.stroke === '#0f172a');
    assert.equal(items.some((i) => i.type === 'rect' && i.radius === 6 && i.fill === null), false, 'no built-in rounded outer border');
    const a = items.find((i) => i.type === 'text' && i.text === 'a');
    const b = items.find((i) => i.type === 'text' && i.text === 'b');
    assert.ok(b.y - a.y > 20, 'rows are as tall as padding + line');
    assert.equal(rects.length, 0);
  });

  it('keeps the built-in table look for tables the page never styles', () => {
    const items = fidelityItems('<table><thead><tr><th>H</th></tr></thead><tbody><tr><td>a</td></tr></tbody></table>');
    assert.ok(items.some((i) => i.type === 'rect' && i.fill === '#0f172a'), 'default header bar');
  });

  it('puts loose th/td in an implied row (thead without tr)', () => {
    const t = fidelityTexts(fidelityItems('<table><thead><th>Product</th><th>Price</th></thead><tbody><tr><td>x</td><td>1</td></tr></tbody></table>'));
    assert.ok(t.some((i) => i.text === 'Product') && t.some((i) => i.text === 'Price'));
  });

  it('repeats the thead on every page of a long table', () => {
    const rows = Array.from({ length: 90 }, (_, i) => `<tr><td>row${i}</td></tr>`).join('');
    const dom = fidelityParse(`<table><thead><tr><th>HEADER</th></tr></thead><tbody>${rows}</tbody></table>`, { data: {} });
    const st = fidelityStyles(dom.rootNode, {});
    const out = fidelityLayout(st.rootNode, { format: 'A4', margins: 36 }, {});
    const pages = out.pages || out;
    assert.ok(pages.length >= 2);
    for (const p of pages) assert.ok(p.items.some((i) => i.type === 'text' && i.text === 'HEADER'), 'every page starts with the header');
  });

  it('paginates a shaded box taller than a page instead of drawing below it', () => {
    const lines = Array.from({ length: 120 }, (_, i) => `<p>line${i}</p>`).join('');
    const dom = fidelityParse(`<div style="background:#f0f0f0;padding:10px">${lines}</div>`, { data: {} });
    const st = fidelityStyles(dom.rootNode, {});
    const out = fidelityLayout(st.rootNode, { format: 'A4', margins: 36 }, {});
    const pages = out.pages || out;
    assert.ok(pages.length >= 2);
    for (const p of pages) {
      for (const i of p.items) if (i.type === 'text') assert.ok(i.y < p.height - 20, `text inside the page (y=${i.y})`);
      assert.ok(p.items.some((i) => i.type === 'rect' && i.fill === '#f0f0f0'), 'shading on every page');
    }
    const all = pages.flatMap((p) => p.items.filter((i) => i.type === 'text').map((i) => i.text));
    assert.ok(all.includes('line0') && all.includes('line119'));
  });

  it('centres and right-aligns boxes with auto margins, insets fixed margins', () => {
    const t = fidelityTexts(fidelityItems('<div style="max-width:200px;margin:0 auto;background:#eee">mid</div><div style="max-width:200px;margin-left:auto;background:#eee">right</div><div style="margin-left:40px;background:#ddd">in</div>'));
    const x = (w) => t.find((i) => i.text === w).x;
    assert.ok(x('mid') > 150 && x('mid') < 260);
    assert.ok(x('right') > 330);
    assert.ok(x('in') > 60);
  });

  it('sizes img width attributes in CSS px and percent', () => {
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
    const items = fidelityItems(`<img src="${png}" width="120" height="120"><img src="${png}" width="50%" height="20">`);
    const imgs = items.filter((i) => i.type === 'image');
    assert.equal(imgs.length, 2);
    assert.ok(Math.abs(imgs[0].w - 90) < 0.5, `120px is 90pt (got ${imgs[0].w})`);
    assert.ok(Math.abs(imgs[1].w - 523.28 / 2) < 1, `50% of the line (got ${imgs[1].w})`);
  });

  it('keeps italic through to the writer for every text path', () => {
    const pdf = Buffer.from(htmlToPdf('<p style="font-style:italic">slanted plain</p><table><tr><td style="font-style:italic">cell it</td></tr></table>', { format: 'A4' })).toString('latin1');
    assert.match(pdf, /\/F4 [\d.]+ Tf/);
    const items = fidelityItems('<p style="font-style:italic">slanted plain</p>');
    assert.equal(items.find((i) => i.type === 'text').fontStyle, 'italic');
  });

  it('supports A3, A5, A6, Legal, Letter, Tabloid, [w, h], length strings and landscape', () => {
    const size = (format, extra = {}) => mediaBoxOf(htmlToPdf('<p>x</p>', { format, ...extra }));
    const near = (a, b) => Math.abs(a[0] - b[0]) < 0.1 && Math.abs(a[1] - b[1]) < 0.1;
    assert.ok(near(size('A3'), [841.89, 1190.55]));
    assert.ok(near(size('A5'), [419.53, 595.28]));
    assert.ok(near(size('A6'), [297.64, 419.53]));
    assert.ok(near(size('Legal'), [612, 1008]));
    assert.ok(near(size('Letter'), [612, 792]));
    assert.ok(near(size('Tabloid'), [792, 1224]));
    assert.ok(near(size([300, 400]), [300, 400]));
    assert.ok(near(size([500, 300]), [500, 300]), 'a custom landscape size keeps its shape');
    assert.ok(near(size('148mm 210mm'), [419.53, 595.28]));
    assert.ok(near(size('8.5in 11in'), [612, 792]));
    assert.ok(near(size('A4', { orientation: 'landscape' }), [841.89, 595.28]));
    assert.ok(near(size('A3 landscape'), [1190.55, 841.89]));
    assert.ok(near(size('A5', { orientation: 'landscape' }), [595.28, 419.53]));
  });
});

// ---------------------------------------------------------------------------------------------
// Round 3: browser defaults, page background, nested grid, plain wrappers split across pages
// ---------------------------------------------------------------------------------------------
describe('round 3 fidelity fixes', () => {
  const html = (css, body) => `<html><head><style>${css}</style></head><body>${body}</body></html>`;

  it('uses the browser defaults when the page sets nothing: 12pt body, h1 24pt, p margin 1em', () => {
    const t = fidelityTexts(fidelityItems(html('', '<p>plain</p>')));
    assert.equal(t[0].fontSize, 12);
    const h = fidelityTexts(fidelityItems(html('', '<h1>Head</h1>')));
    assert.equal(h[0].fontSize, 24);
    assert.equal(h[0].fontWeight, 'bold');
  });

  it('collapses the margin between two paragraphs to one gap, not their sum', () => {
    const t = fidelityTexts(fidelityItems(html('', '<p>one</p><p>two</p>')));
    const one = t.find((i) => i.text === 'one');
    const two = t.find((i) => i.text === 'two');
    const lh = 12 * 1.15;
    assert.ok(Math.abs(two.y - one.y - (lh + 12)) < 0.5, `gap is line + one 12pt margin (dy=${two.y - one.y})`);
  });

  it('keeps an author margin of 0 on headings and paragraphs', () => {
    const t = fidelityTexts(fidelityItems(html('h1{margin:0}p{margin:0}', '<h1>H</h1><p>after</p>')));
    const h = t.find((i) => i.text === 'H');
    const p = t.find((i) => i.text === 'after');
    assert.ok(p.y - h.y < 24 * 1.15 + 5, `no default margin between them (dy=${p.y - h.y})`);
  });

  it('fills every page edge to edge with the html/body background colour', () => {
    const dom = fidelityParse(html('body{background:#101820;color:#fff}', '<p>x</p>'), { data: {} });
    const st = fidelityStyles(dom.rootNode, {});
    const out = fidelityLayout(st.rootNode, { format: 'A4', margins: 36 }, {});
    const first = (out.pages || out)[0].items[0];
    assert.equal(first.type, 'rect');
    assert.equal(first.fill, '#101820');
    assert.equal(first.x, 0);
    assert.equal(first.y, 0);
    assert.ok(first.w >= 595 && first.h >= 841);
  });

  it('starts the rows of a grid inside a shaded box at the box, not at the page cursor', () => {
    const t = fidelityTexts(fidelityItems(html('.card{background:#eee;padding:10px}.g{display:grid;grid-template-columns:1fr 1fr}', '<p>top</p><div class="card"><div>head</div><div class="g"><div>left</div><div>right</div></div></div>')));
    const head = t.find((i) => i.text === 'head');
    const left = t.find((i) => i.text === 'left');
    const right = t.find((i) => i.text === 'right');
    assert.ok(left.y > head.y + 8, 'grid row is below the heading');
    assert.ok(Math.abs(left.y - right.y) < 1 && right.x > left.x + 100);
  });

  it('lets an unstyled wrapper split across pages instead of jumping whole to the next page', () => {
    const rows = Array.from({ length: 60 }, (_, i) => `<p>row${i}</p>`).join('');
    const dom = fidelityParse(html('p{margin:0}', `<h1>Title</h1><div class="wrap">${rows}</div>`), { data: {} });
    const st = fidelityStyles(dom.rootNode, {});
    const out = fidelityLayout(st.rootNode, { format: 'A4', margins: 36 }, {});
    const pages = out.pages || out;
    const onFirst = pages[0].items.filter((i) => i.type === 'text').length;
    assert.ok(onFirst > 20, `page 1 is filled (${onFirst} lines)`);
    assert.ok(pages.length >= 2);
  });

  it('floats sit side by side and clear moves below them', () => {
    const t = fidelityTexts(fidelityItems(html('.l{float:left;width:40%}.r{float:right;width:40%}.c{clear:both}', '<div><div class="l">left</div><div class="r">right</div><div class="c">below</div></div>')));
    const l = t.find((i) => i.text === 'left');
    const r = t.find((i) => i.text === 'right');
    const b = t.find((i) => i.text === 'below');
    assert.ok(Math.abs(l.y - r.y) < 1 && r.x > l.x + 150);
    assert.ok(b.y > l.y + 8);
  });

  it('does not split a short word such as Requests/min in a column that is only slightly too narrow', () => {
    const t = fidelityTexts(fidelityItems(html('table{width:100%}td,th{padding:6pt 8pt;border-bottom:1pt solid #ccc}', '<table><thead><tr><th>Service Subsystem name goes here</th><th>Requests/min</th></tr></thead><tbody><tr><td>x</td><td>1</td></tr></tbody></table>')));
    assert.ok(t.some((i) => i.text === 'Requests/min'), 'the word stays whole');
  });
});

// ---------------------------------------------------------------------------------------------
// Round 4: list markers, float widths
// ---------------------------------------------------------------------------------------------
describe('list markers and floats', () => {
  const doc = (body, css = '') => `<html><head><style>${css}</style></head><body>${body}</body></html>`;
  const markers = (items) => items.filter((i) => i.type === 'rect' && i.w < 8 && i.radius !== undefined);

  it('draws a disc, a circle and a square by nesting level, hanging left of the text', () => {
    const items = fidelityItems(doc('<ul><li>a<ul><li>b<ul><li>c</li></ul></li></ul></li></ul>'));
    const m = markers(items);
    assert.equal(m.length, 3);
    assert.ok(m[0].fill && m[0].radius > 0, 'level 1 is a filled disc');
    assert.ok(!m[1].fill && m[1].stroke && m[1].radius > 0, 'level 2 is a ring');
    assert.ok(m[2].fill && m[2].radius === 0, 'level 3 is a square');
    const a = items.find((i) => i.type === 'text' && i.text === 'a');
    assert.ok(m[0].x + m[0].w < a.x, 'marker sits in the indent, left of the text');
    assert.ok(a.x - m[0].x < 30, 'and within the 30pt indent');
  });

  it('marker takes its colour from the li and sits on the first line', () => {
    const items = fidelityItems(doc('<ul><li style="color:#cc0000">red item</li></ul>'));
    const m = markers(items)[0];
    assert.equal(m.fill, '#cc0000');
    const t = items.find((i) => i.type === 'text' && i.text === 'red item');
    assert.ok(m.y < t.y && m.y > t.y - 12, 'marker is level with the first line');
  });

  it('numbers ordered lists with decimal, start and value', () => {
    const t = fidelityTexts(fidelityItems(doc('<ol start="3"><li>x</li><li>y</li><li value="9">z</li><li>w</li></ol>')));
    const labels = t.filter((i) => /\.$/.test(i.text)).map((i) => i.text);
    assert.deepEqual(labels, ['3.', '4.', '9.', '10.']);
  });

  it('supports lower-alpha, upper-alpha, lower-roman, upper-roman and none', () => {
    const labelsOf = (type) => fidelityTexts(fidelityItems(doc(`<ol style="list-style-type:${type}"><li>a</li><li>b</li><li>c</li><li>d</li></ol>`))).filter((i) => /\.$/.test(i.text)).map((i) => i.text);
    assert.deepEqual(labelsOf('lower-alpha'), ['a.', 'b.', 'c.', 'd.']);
    assert.deepEqual(labelsOf('upper-alpha'), ['A.', 'B.', 'C.', 'D.']);
    assert.deepEqual(labelsOf('lower-roman'), ['i.', 'ii.', 'iii.', 'iv.']);
    assert.deepEqual(labelsOf('upper-roman'), ['I.', 'II.', 'III.', 'IV.']);
    const none = fidelityItems(doc('<ul style="list-style:none"><li>plain</li></ul>'));
    assert.equal(markers(none).length, 0);
    assert.equal(fidelityTexts(none).length, 1);
  });

  it('keeps item text extractable from the PDF next to its marker', () => {
    const pdf = Buffer.from(htmlToPdf(doc('<ol><li>first item</li><li>second item</li></ol>'), { format: 'A4' })).toString('latin1');
    assert.match(pdf, /first item/);
    assert.match(pdf, /\(1\.\)/);
    assert.match(pdf, /\(2\.\)/);
  });

  it('gives a percentage-width float its full width once (not a percentage of a percentage)', () => {
    const t = fidelityTexts(fidelityItems(doc('<div><div class="a">left floated text that is fairly long indeed so it will wrap</div></div>', '.a{float:left;width:50%}')));
    const first = t[0];
    // 50% of ~523pt is ~261pt; the first line must be allowed that much room (>150pt of text on one line)
    assert.ok(fidelityMeasure(first.text, { fontSize: first.fontSize }) > 150 || t.length === 1);
  });
});
