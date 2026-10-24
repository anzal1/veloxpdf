import http from 'node:http';
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
  extractEmbeddedData,
} from './src/index.mjs';

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(SERVER_DIR, 'public');
const PORT = +(process.env.PORT || 8585);

export const defaultCert = generateSelfSignedCert({
  commonName: 'VeloxPDF Authority',
  org: 'VeloxPDF Inc.',
});

// 6 Rich Production Presets for Studio & CLI
export const PRESETS = {
  invoice: {
    id: 'invoice',
    name: 'Enterprise Tax Invoice & Crypto Receipt',
    category: 'Finance',
    format: 'A4',
    sign: true,
    data: {
      Company: 'VeloxPDF Enterprise Cloud',
      InvoiceNumber: 'INV-2026-99412',
      Date: '24 Oct 2026',
      CustomerName: 'Acme Robotics Corp',
      CustomerAddress: '742 Evergreen Terrace, San Francisco, CA 94107',
      PaymentMethod: 'Instant ACH · ISO-20022-RTP',
      GrandTotal: '$14,820.00',
      Items: [
        { Name: 'Zero-Chromium Vector PDF Engine License', Category: 'Core SDK', Qty: '1', Price: '$6,500.00', Total: '$6,500.00' },
        { Name: 'High-Throughput X.509 Cryptographic Signer', Category: 'Security', Qty: '2', Price: '$2,400.00', Total: '$4,800.00' },
        { Name: 'Edge Worker Multi-Region Deployment Pack', Category: 'Cloud', Qty: '1', Price: '$3,520.00', Total: '$3,520.00' },
      ],
    },
    template: `<!doctype html>
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
      <div class="flex items-center gap-3">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #818cf8;">
          <path d="M 12 2 A 10 10 0 1 0 22 12 A 10 10 0 0 0 12 2 Z"/>
          <path d="M 9 12 L 11 14 L 15 10" stroke="#ffffff"/>
        </svg>
        <div class="text-2xl font-bold text-white">{{.Company}}</div>
      </div>
      <div class="text-sm text-slate-300 mt-1">Tax Invoice & Cryptographic Receipt · {{.InvoiceNumber}}</div>
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
      <div class="text-xs text-slate-600">Settlement: Instant RTP</div>
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
        <th class="text-right">Qty</th>
        <th class="text-right">Unit Price</th>
        <th class="text-right">Line Total</th>
      </tr>
    </thead>
    <tbody>
      {{range .Items}}
      <tr>
        <td>
          <b>{{.Name}}</b><br>
          <span style="color:#64748b;font-size:8pt">{{.Category}} · Tier 1 High-Availability SLA · 99.999% Uptime</span>
        </td>
        <td>{{.Category}}</td>
        <td class="text-right">{{.Qty}}</td>
        <td class="text-right">{{.Price}}</td>
        <td class="text-right"><b>{{.Total}}</b></td>
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
  <div style="border-left: 3pt solid #4f46e5; background: #f8fafc; padding: 10pt 14pt; margin-top: 14pt; border-radius: 0 6pt 6pt 0; box-shadow: 0 1pt 3pt rgba(0,0,0,0.05);">
    <div style="font-weight: bold; color: #1e1b4b; font-size: 9.5pt;">Enterprise Cryptographic Verification Guarantee</div>
    <div style="color: #64748b; font-size: 8.5pt; margin-top: 2pt;">
      This invoice is cryptographically sealed with an ISO 32000-1 X.509 PKCS#7 digital signature. Tamper-evident ByteRange digest ensures immutable non-repudiation.
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
</html>`,
  },

  ledger: {
    id: 'ledger',
    name: 'Multi-Page Financial Audit Ledger',
    category: 'Accounting',
    format: 'A4',
    sign: true,
    headerText: 'CONFIDENTIAL · ACME GLOBAL AUDIT · Q4-2026',
    footerText: 'Page {{page}} of {{pages}} · VeloxPDF Deterministic Paginate',
    data: {
      AuditTitle: 'Global Settlement & Shard Audit Ledger',
      Period: 'Q4 2026 (Oct 1 - Oct 24, 2026)',
      Auditor: 'Velox Trust & Attestation LLP',
      TotalRecords: '45 Transactions',
      TotalVolume: '$482,910.45',
    },
    template: `<!doctype html>
<html>
<head>
  <style>
    @page { size: A4; margin: 36pt; }
    body { font-family: Helvetica, sans-serif; font-size: 9.5pt; color: #0f172a; }
    h1 { font-size: 16pt; font-weight: bold; margin-bottom: 4pt; }
    .meta-bar { display: flex; justify-content: space-between; padding: 10pt; background: #f1f5f9; border-radius: 6pt; margin-bottom: 12pt; font-size: 9pt; }
    table { width: 100%; border-collapse: collapse; }
    th { background-color: #0f172a; color: #ffffff; padding: 6.5pt 8pt; text-align: left; font-weight: bold; font-size: 8.5pt; }
    td { padding: 6pt 8pt; border-bottom: 1pt solid #e2e8f0; font-size: 8.5pt; }
    tr:nth-child(even) td { background-color: #f8fafc; }
    .num { text-align: right; }
    .badge-pass { background: #dcfce7; color: #166534; padding: 2pt 5pt; border-radius: 4pt; font-size: 7.5pt; font-weight: bold; }
    .badge-flag { background: #fee2e2; color: #991b1b; padding: 2pt 5pt; border-radius: 4pt; font-size: 7.5pt; font-weight: bold; }
  </style>
</head>
<body>
  <h1>{{.AuditTitle}}</h1>
  <div class="meta-bar">
    <div><b>Audit Period:</b> {{.Period}}</div>
    <div><b>Auditor:</b> {{.Auditor}}</div>
    <div><b>Total Volume:</b> {{.TotalVolume}}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Txn Hash</th>
        <th>Timestamp</th>
        <th>Description</th>
        <th>Status</th>
        <th class="num">Amount (USD)</th>
        <th class="num">Running Balance</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><code>0x8f2a1b9c</code></td>
        <td>2026-10-01 08:14</td>
        <td>Shard #01 Batch Settlement - Automated ACH</td>
        <td><span class="badge-pass">SETTLED</span></td>
        <td class="num">$14,200.00</td>
        <td class="num">$14,200.00</td>
      </tr>
      <tr>
        <td><code>0x7e3c9a10</code></td>
        <td>2026-10-01 11:30</td>
        <td>Compute Ingress Shard #04 Reserve</td>
        <td><span class="badge-pass">SETTLED</span></td>
        <td class="num">$8,450.50</td>
        <td class="num">$22,650.50</td>
      </tr>
      <tr>
        <td><code>0x6d4b8e21</code></td>
        <td>2026-10-02 09:45</td>
        <td>Cross-Border Wire Transfer Settlement</td>
        <td><span class="badge-pass">SETTLED</span></td>
        <td class="num">$32,100.00</td>
        <td class="num">$54,750.50</td>
      </tr>
      <tr>
        <td><code>0x5a1c7d32</code></td>
        <td>2026-10-03 14:22</td>
        <td>Cryptographic HSM Module Renewal</td>
        <td><span class="badge-pass">SETTLED</span></td>
        <td class="num">$6,800.00</td>
        <td class="num">$61,550.50</td>
      </tr>
      <tr>
        <td><code>0x4b2d6e43</code></td>
        <td>2026-10-04 16:05</td>
        <td>Latency Arbitrage Shard #09 Allocation</td>
        <td><span class="badge-flag">AUDITED</span></td>
        <td class="num">$19,400.00</td>
        <td class="num">$80,950.50</td>
      </tr>
      <tr>
        <td><code>0x3c3e5f54</code></td>
        <td>2026-10-05 10:11</td>
        <td>Zero-Knowledge Proof Verification Grant</td>
        <td><span class="badge-pass">SETTLED</span></td>
        <td class="num">$11,250.00</td>
        <td class="num">$92,200.50</td>
      </tr>
      <tr>
        <td><code>0x2d4f4a65</code></td>
        <td>2026-10-06 13:40</td>
        <td>Multi-Region Storage Rebalance</td>
        <td><span class="badge-pass">SETTLED</span></td>
        <td class="num">$4,920.00</td>
        <td class="num">$97,120.50</td>
      </tr>
      <tr>
        <td><code>0x1e5a3b76</code></td>
        <td>2026-10-07 17:15</td>
        <td>Enterprise Support Tier 1 Q4 Retainer</td>
        <td><span class="badge-pass">SETTLED</span></td>
        <td class="num">$25,000.00</td>
        <td class="num">$122,120.50</td>
      </tr>
      <tr>
        <td><code>0x0f6b2c87</code></td>
        <td>2026-10-08 09:00</td>
        <td>Database Read Replica Shard Cluster #12</td>
        <td><span class="badge-pass">SETTLED</span></td>
        <td class="num">$7,340.00</td>
        <td class="num">$129,460.50</td>
      </tr>
      <tr>
        <td><code>0xfa7c1d98</code></td>
        <td>2026-10-09 12:20</td>
        <td>EU Central Payment Gateway Clearing</td>
        <td><span class="badge-pass">SETTLED</span></td>
        <td class="num">$18,600.00</td>
        <td class="num">$148,060.50</td>
      </tr>
      <tr>
        <td><code>0xeb8d0ea9</code></td>
        <td>2026-10-10 15:45</td>
        <td>Security Red Team Cryptanalysis Bounty</td>
        <td><span class="badge-pass">SETTLED</span></td>
        <td class="num">$15,000.00</td>
        <td class="num">$163,060.50</td>
      </tr>
      <tr>
        <td><code>0xdc9e9fb0</code></td>
        <td>2026-10-11 18:30</td>
        <td>Cold Storage Archive Ingestion Run #88</td>
        <td><span class="badge-pass">SETTLED</span></td>
        <td class="num">$3,420.00</td>
        <td class="num">$166,480.50</td>
      </tr>
      <tr>
        <td><code>0xcb0f8ea1</code></td>
        <td>2026-10-12 11:15</td>
        <td>Direct Fiber Peer Transit Tokyo-SFO</td>
        <td><span class="badge-pass">SETTLED</span></td>
        <td class="num">$22,800.00</td>
        <td class="num">$189,280.50</td>
      </tr>
      <tr>
        <td><code>0xba1a7db2</code></td>
        <td>2026-10-13 14:50</td>
        <td>Automated Treasury Yield Sweep</td>
        <td><span class="badge-pass">SETTLED</span></td>
        <td class="num">$41,500.00</td>
        <td class="num">$230,780.50</td>
      </tr>
      <tr>
        <td><code>0xa92b6ec3</code></td>
        <td>2026-10-14 16:10</td>
        <td>Global Anycast IP Block Lease Renewal</td>
        <td><span class="badge-pass">SETTLED</span></td>
        <td class="num">$12,000.00</td>
        <td class="num">$242,780.50</td>
      </tr>
      <tr>
        <td><code>0x983c5fd4</code></td>
        <td>2026-10-15 10:25</td>
        <td>VeloxPDF Enterprise Runtime Fleet License</td>
        <td><span class="badge-pass">SETTLED</span></td>
        <td class="num">$65,000.00</td>
        <td class="num">$307,780.50</td>
      </tr>
      <tr>
        <td><code>0x874d4ee5</code></td>
        <td>2026-10-16 13:00</td>
        <td>Synthetic Canary Latency Monitor Shards</td>
        <td><span class="badge-pass">SETTLED</span></td>
        <td class="num">$5,130.00</td>
        <td class="num">$312,910.50</td>
      </tr>
      <tr>
        <td><code>0x765e3ff6</code></td>
        <td>2026-10-17 17:40</td>
        <td>Disaster Recovery Hot Standby Zone Virginia</td>
        <td><span class="badge-pass">SETTLED</span></td>
        <td class="num">$38,000.00</td>
        <td class="num">$350,910.50</td>
      </tr>
      <tr>
        <td><code>0x656f2a07</code></td>
        <td>2026-10-18 09:50</td>
        <td>Audit & Compliance Log Archival Run #142</td>
        <td><span class="badge-pass">SETTLED</span></td>
        <td class="num">$4,000.00</td>
        <td class="num">$354,910.50</td>
      </tr>
      <tr>
        <td><code>0x547a1b18</code></td>
        <td>2026-10-19 12:15</td>
        <td>High-Speed Cryptographic Signing Shard #03</td>
        <td><span class="badge-pass">SETTLED</span></td>
        <td class="num">$18,500.00</td>
        <td class="num">$373,410.50</td>
      </tr>
      <tr>
        <td><code>0x438b0c29</code></td>
        <td>2026-10-20 15:30</td>
        <td>Primary Colocation Power & Cooling Surcharge</td>
        <td><span class="badge-pass">SETTLED</span></td>
        <td class="num">$9,500.00</td>
        <td class="num">$382,910.50</td>
      </tr>
      <tr>
        <td><code>0x329c9d3a</code></td>
        <td>2026-10-21 16:45</td>
        <td>Parametric Compiler Shard Cluster Node Fleet</td>
        <td><span class="badge-pass">SETTLED</span></td>
        <td class="num">$42,000.00</td>
        <td class="num">$424,910.50</td>
      </tr>
      <tr>
        <td><code>0x21ad8e4b</code></td>
        <td>2026-10-22 11:20</td>
        <td>Post-Quantum Lattice Cryptography Sandbox</td>
        <td><span class="badge-pass">SETTLED</span></td>
        <td class="num">$28,000.00</td>
        <td class="num">$452,910.50</td>
      </tr>
      <tr>
        <td><code>0x10be7f5c</code></td>
        <td>2026-10-23 14:05</td>
        <td>Inter-Region High-Bandwidth Mesh Peering</td>
        <td><span class="badge-pass">SETTLED</span></td>
        <td class="num">$16,500.00</td>
        <td class="num">$469,410.50</td>
      </tr>
      <tr>
        <td><code>0x01cf6a6d</code></td>
        <td>2026-10-24 10:00</td>
        <td>Quarterly Settlement Reconciliation Final Balance</td>
        <td><span class="badge-pass">SETTLED</span></td>
        <td class="num">$13,500.00</td>
        <td class="num">$482,910.45</td>
      </tr>
    </tbody>
  </table>
</body>
</html>`,
  },

  boarding: {
    id: 'boarding',
    name: 'Flight Boarding Pass & Logistics Label',
    category: 'Logistics',
    format: 'A4',
    sign: true,
    data: {
      PassengerName: 'HAWKINS / ELEANOR MS',
      FlightNumber: 'VX-8842',
      FromCode: 'SFO',
      FromName: 'San Francisco Intl',
      ToCode: 'JFK',
      ToName: 'New York John F Kennedy',
      DepartureTime: '14:20',
      ArrivalTime: '22:45',
      Date: '24 OCT 2026',
      Gate: '54B',
      Seat: '03A',
      Class: 'FIRST / SUITE',
      SeqNo: '0042',
      BarcodeValue: 'VX8842JFK03AFIRST',
    },
    template: `<!doctype html>
<html>
<head>
  <style>
    @page { size: landscape; margin: 20pt; }
    body { font-family: Helvetica, sans-serif; color: #0f172a; margin: 0; padding: 0; }
    .ticket-card {
      border: 2pt solid #0f172a; border-radius: 12pt; overflow: hidden;
      display: grid; grid-template-columns: 72% 28%;
      background: #ffffff;
    }
    .ticket-main { padding: 12pt 18pt; border-right: 2pt dashed #cbd5e1; }
    .ticket-stub { padding: 12pt 14pt; background: #f8fafc; display: flex; flex-direction: column; justify-content: space-between; }
    .airline-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8pt; }
    .air-logo { font-size: 16pt; font-weight: 900; letter-spacing: 1pt; color: #4f46e5; }
    .flight-route { display: flex; align-items: center; justify-content: space-between; margin: 8pt 0; padding: 8pt 14pt; background: #f1f5f9; border-radius: 8pt; }
    .city-code { font-size: 28pt; font-weight: 900; line-height: 1; }
    .city-name { font-size: 8.5pt; color: #64748b; margin-top: 2pt; }
    .grid-info { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8pt; margin: 8pt 0; }
    .info-lbl { font-size: 7.5pt; color: #64748b; font-weight: bold; text-transform: uppercase; }
    .info-val { font-size: 12pt; font-weight: bold; color: #0f172a; margin-top: 2pt; }
    .barcode-box { margin-top: 8pt; padding: 4pt 0; text-align: center; }
  </style>
</head>
<body>
  <div class="ticket-card">
    <div class="ticket-main">
      <div class="airline-bar">
        <div class="air-logo">VELOX AIRLINES · PRIORITY</div>
        <div style="font-size: 10pt; font-weight: bold; color: #166534; background: #dcfce7; padding: 3pt 8pt; border-radius: 4pt;">BOARDING PASS</div>
      </div>

      <div class="flight-route">
        <div>
          <div class="city-code">{{.FromCode}}</div>
          <div class="city-name">{{.FromName}}</div>
          <div style="font-size: 12pt; font-weight: bold; margin-top: 4pt;">{{.DepartureTime}}</div>
        </div>
        <div style="text-align: center;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
          </svg>
          <div style="font-size: 9pt; font-weight: bold; color: #4f46e5; margin-top: 2pt;">NON-STOP</div>
        </div>
        <div style="text-align: right;">
          <div class="city-code">{{.ToCode}}</div>
          <div class="city-name">{{.ToName}}</div>
          <div style="font-size: 12pt; font-weight: bold; margin-top: 4pt;">{{.ArrivalTime}}</div>
        </div>
      </div>

      <div class="grid-info">
        <div>
          <div class="info-lbl">Passenger</div>
          <div class="info-val">{{.PassengerName}}</div>
        </div>
        <div>
          <div class="info-lbl">Flight</div>
          <div class="info-val">{{.FlightNumber}}</div>
        </div>
        <div>
          <div class="info-lbl">Gate</div>
          <div class="info-val" style="color: #4f46e5;">{{.Gate}}</div>
        </div>
        <div>
          <div class="info-lbl">Seat</div>
          <div class="info-val" style="color: #4f46e5;">{{.Seat}}</div>
        </div>
      </div>

      <div class="barcode-box">
        <barcode value="{{.BarcodeValue}}" height="36"></barcode>
        <div style="font-family: monospace; font-size: 8pt; letter-spacing: 2pt; margin-top: 3pt;">{{.BarcodeValue}}</div>
      </div>
    </div>

    <div class="ticket-stub">
      <div>
        <div style="font-size: 11pt; font-weight: 900; color: #4f46e5;">PASSENGER STUB</div>
        <div style="font-size: 8pt; color: #64748b; margin-top: 2pt;">{{.Date}}</div>
      </div>

      <div style="margin: 10pt 0;">
        <div class="info-lbl">Flight / Class</div>
        <div style="font-size: 11pt; font-weight: bold;">{{.FlightNumber}} · {{.Class}}</div>
        <div class="info-lbl" style="margin-top: 6pt;">Seat</div>
        <div style="font-size: 20pt; font-weight: 900; color: #4f46e5;">{{.Seat}}</div>
      </div>

      <div style="text-align: center; margin-top: auto;">
        <qr value="https://veloxpdf.dev/gate/{{.FlightNumber}}/{{.Seat}}" size="72"></qr>
        <div style="font-size: 7.5pt; color: #64748b; margin-top: 4pt;">GATE SCAN VALID</div>
      </div>
    </div>
  </div>
</body>
</html>`,
  },

  certificate: {
    id: 'certificate',
    name: 'Security Audit & Compliance Certificate',
    category: 'Security',
    format: 'A4',
    sign: true,
    data: {
      Organization: 'CyberDefend Global Networks Corp.',
      Standard: 'ISO/IEC 27001:2022 & SOC 2 Type II',
      CertificateNumber: 'CERT-2026-X509-08942',
      ValidUntil: '24 October 2029',
      AuditorName: 'Velox Security Compliance Authority',
      Digest: '3c8f941a8b29c5e20d3f81e647192a5b6c7d8e9f0123456789abcdef01234567',
    },
    template: `<!doctype html>
<html>
<head>
  <style>
    @page { size: landscape; margin: 24pt; }
    body { font-family: Helvetica, sans-serif; color: #0f172a; margin: 0; padding: 0; }
    .cert-frame {
      border: 3pt solid #1e293b; padding: 16pt 22pt; border-radius: 12pt;
      background: radial-gradient(circle at center, #ffffff 60%, #f8fafc 100%);
      text-align: center;
    }
    .cert-title { font-size: 20pt; font-weight: 900; letter-spacing: 2pt; color: #0f172a; margin-top: 4pt; text-transform: uppercase; }
    .cert-sub { font-size: 10.5pt; color: #64748b; letter-spacing: 1pt; margin-top: 2pt; }
    .awarded-to { font-size: 9.5pt; text-transform: uppercase; color: #64748b; letter-spacing: 2pt; margin-top: 8pt; }
    .org-name { font-size: 22pt; font-weight: bold; color: #1e1b4b; margin: 3pt 0; }
    .standard-name { font-size: 12pt; font-weight: bold; color: #4f46e5; margin: 2pt 0 8pt; }
    .cert-desc { font-size: 9pt; color: #475569; max-width: 580pt; margin: 0 auto 10pt; line-height: 1.45; }
    .footer-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; align-items: center; border-top: 1pt solid #e2e8f0; padding-top: 8pt; margin-top: 6pt; }
  </style>
</head>
<body>
  <div class="cert-frame">
    <div style="display: inline-block;">
      <svg width="44" height="44" viewBox="0 0 100 100">
        <polygon points="50,5 90,25 90,65 50,95 10,65 10,25" fill="#4f46e5"/>
        <polygon points="50,15 80,30 80,60 50,83 20,60 20,30" fill="#312e81"/>
        <path d="M 36 50 L 46 60 L 66 40" stroke="#22c55e" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      </svg>
    </div>

    <div class="cert-title">Certificate of Cryptographic Attestation</div>
    <div class="cert-sub">ISO 32000-1 Digital Security Standard</div>

    <div class="awarded-to">This attestation is formally granted to</div>
    <div class="org-name">{{.Organization}}</div>
    <div class="standard-name">{{.Standard}}</div>

    <div class="cert-desc">
      Having satisfied all independent technical verification requirements, zero-trust infrastructure audits,
      and hardware-enforced cryptographic signing procedures verified under FIPS 140-3 standards.
    </div>

    <div class="footer-grid">
      <div style="text-align: left;">
        <div style="font-size: 8pt; color: #64748b; font-weight: bold;">CERTIFICATE ID</div>
        <div style="font-size: 9pt; font-family: monospace; font-weight: bold;">{{.CertificateNumber}}</div>
        <div style="font-size: 8pt; color: #64748b; margin-top: 4pt;">Valid Through: {{.ValidUntil}}</div>
      </div>
      <div>
        <qr value="https://veloxpdf.dev/cert/{{.CertificateNumber}}" size="64"></qr>
        <div style="font-size: 7.5pt; color: #64748b; margin-top: 2pt;">Live Public Attestation</div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 8pt; color: #64748b; font-weight: bold;">ISSUING AUTHORITY</div>
        <div style="font-size: 9.5pt; font-weight: bold; color: #166534;">{{.AuditorName}}</div>
        <div style="font-size: 8pt; color: #64748b; margin-top: 4pt;">San Francisco, CA · Root CA</div>
      </div>
    </div>
  </div>
</body>
</html>`,
  },

  telemetry: {
    id: 'telemetry',
    name: 'SaaS Platform Usage & Reliability Report',
    category: 'Analytics',
    format: 'A4',
    sign: true,
    data: {
      Tenant: 'Vanguard Global Financial Shards',
      ReportDate: 'October 24, 2026',
      TotalRequests: '148,920,410',
      P99Latency: '0.42 ms',
      VectorOpsPerSec: '1,140 pages/sec',
      TotalPagesGenerated: '4,821,900',
    },
    template: `<!doctype html>
<html>
<head>
  <style>
    @page { size: A4; margin: 36pt; }
    body { font-family: Helvetica, sans-serif; color: #0f172a; font-size: 9.5pt; }
    .hero { background: #0f172a; color: #ffffff; padding: 18pt 20pt; border-radius: 8pt; margin-bottom: 14pt; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10pt; margin-bottom: 14pt; }
    .kpi-card { background: #f8fafc; border: 1pt solid #e2e8f0; padding: 12pt; border-radius: 8pt; }
    .kpi-lbl { font-size: 8pt; color: #64748b; font-weight: bold; text-transform: uppercase; }
    .kpi-val { font-size: 16pt; font-weight: 900; color: #4f46e5; margin-top: 3pt; }
    .chart-box { background: #ffffff; border: 1pt solid #e2e8f0; border-radius: 8pt; padding: 14pt; margin-bottom: 14pt; }
    table { width: 100%; border-collapse: collapse; margin-top: 8pt; }
    th { background: #f1f5f9; color: #475569; padding: 6pt 8pt; text-align: left; font-size: 8.5pt; }
    td { padding: 6pt 8pt; border-bottom: 1pt solid #e2e8f0; font-size: 8.5pt; }
    .num { text-align: right; }
  </style>
</head>
<body>
  <div class="hero flex justify-between items-center">
    <div>
      <div class="text-xl font-bold">Platform Reliability & Telemetry Report</div>
      <div class="text-xs text-slate-300 mt-1">Tenant: {{.Tenant}} · Generated: {{.ReportDate}}</div>
    </div>
    <div class="text-right">
      <div style="font-size: 9pt; font-weight: bold; background: #065f46; color: #34d399; padding: 3pt 8pt; border-radius: 4pt; display: inline-block;">SLA: 99.999% HEALTHY</div>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-lbl">Total Requests</div>
      <div class="kpi-val">{{.TotalRequests}}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-lbl">P99 Latency</div>
      <div class="kpi-val" style="color: #059669;">{{.P99Latency}}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-lbl">Compiler Throughput</div>
      <div class="kpi-val">{{.VectorOpsPerSec}}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-lbl">PDF Pages Generated</div>
      <div class="kpi-val">{{.TotalPagesGenerated}}</div>
    </div>
  </div>

  <div class="chart-box">
    <div class="text-sm font-bold text-slate-900 mb-2">Hourly PDF Generation Velocity & P99 Distribution</div>
    <canvas id="telemetry-chart" width="510" height="90"></canvas>
  </div>

  <div class="text-sm font-bold text-slate-900 mt-4 mb-2">Active Service Endpoints & Performance</div>
  <table>
    <thead>
      <tr>
        <th>Service Subsystem</th>
        <th>Runtime Mode</th>
        <th class="num">Requests/min</th>
        <th class="num">p50</th>
        <th class="num">p99</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><code>/v1/pdf/render</code> (Universal HTML/Tailwind)</td>
        <td>Cold JIT Sandboxed</td>
        <td class="num">18,420</td>
        <td class="num">0.38 ms</td>
        <td class="num">0.52 ms</td>
        <td style="color: #059669; font-weight: bold;">OPTIMAL</td>
      </tr>
      <tr>
        <td><code>/v1/pdf/parametric</code> (Futamura Staged Compiler)</td>
        <td>Direct Vector Stream</td>
        <td class="num">42,100</td>
        <td class="num">0.08 ms</td>
        <td class="num">0.14 ms</td>
        <td style="color: #059669; font-weight: bold;">OPTIMAL</td>
      </tr>
      <tr>
        <td><code>/v1/pdf/sign</code> (X.509 PKCS#7 Attached/Detached)</td>
        <td>Hardware Enclave</td>
        <td class="num">24,500</td>
        <td class="num">0.32 ms</td>
        <td class="num">0.45 ms</td>
        <td style="color: #059669; font-weight: bold;">OPTIMAL</td>
      </tr>
      <tr>
        <td><code>/v1/pdf/verify</code> (Cryptographic ByteRange Validator)</td>
        <td>Zero-Copy Stream</td>
        <td class="num">31,000</td>
        <td class="num">0.12 ms</td>
        <td class="num">0.19 ms</td>
        <td style="color: #059669; font-weight: bold;">OPTIMAL</td>
      </tr>
    </tbody>
  </table>

  <script>
    const c = document.getElementById('telemetry-chart');
    if (c && c.getContext) {
      const ctx = c.getContext('2d');
      const data = [42, 58, 65, 82, 74, 91, 88, 95, 104, 112, 108, 120];
      const step = 40;
      for (let i = 0; i < data.length; i++) {
        ctx.fillStyle = '#e0e7ff';
        ctx.fillRect(i * step + 12, 85 - (data[i] * 0.65), 24, data[i] * 0.65);
      }
      ctx.strokeStyle = '#4f46e5';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i < data.length; i++) {
        const x = i * step + 24;
        const y = 85 - (data[i] * 0.65);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  </script>
</body>
</html>`,
  },
  complex: {
    id: 'complex',
    name: 'Extreme Stress-Test: Rowspan + Watermark + Bezier Canvas + Barcode/QR',
    category: 'Derivatives & Stress',
    format: 'A4',
    sign: true,
    data: {
      PortfolioTitle: 'Global Macro Derivatives & Liquidity Matrix',
      AttestationId: 'ATT-2026-X9921',
      Timestamp: '24 Oct 2026 · 18:30 UTC',
      Desk: 'Systemic Risk & Quantitative Arbitrage',
      Regulator: 'ISO-32000 / CFTC / ESMA Compliant',
      TotalNotionalUSD: '$1,482,900,000',
      EurTotal: '€1,385,000,000',
      GbpTotal: '£1,190,000,000',
      InrTotal: '₹124,500,000,000',
      JpyTotal: '¥228,000,000,000',
    },
    template: `<!doctype html>
<html>
<head>
  <style>
    @page { size: A4; margin: 24pt; }
    :root { --brand: #4f46e5; --ink: #0f172a; }
    body { font-family: Helvetica, sans-serif; color: var(--ink); font-size: 8.5pt; }
    .header-box { background: linear-gradient(135deg, #0f172a, #1e1b4b); color: #ffffff; padding: 10pt 14pt; border-radius: 8pt; margin-bottom: 8pt; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8pt; }
    th { background-color: #0f172a; color: #ffffff; padding: 5pt 6pt; text-align: left; font-weight: bold; font-size: 8pt; border: 0.5pt solid #334155; }
    td { padding: 4.5pt 6pt; border: 0.5pt solid #cbd5e1; font-size: 8pt; }
    tr:nth-child(even) td { background-color: #f8fafc; }
    tfoot td { background-color: #f1f5f9; font-weight: bold; border-top: 1.5pt solid #0f172a; }
    .num { text-align: right; }
    .center { text-align: center; }
    .badge-pass { background-color: #dcfce7; color: #166534; padding: 2pt 5pt; border-radius: 4pt; font-weight: bold; font-size: 7.5pt; }
    .badge-opt { background-color: #e0e7ff; color: #3730a3; padding: 2pt 5pt; border-radius: 4pt; font-weight: bold; font-size: 7.5pt; }
    .badge-attn { background-color: #fef3c7; color: #92400e; padding: 2pt 5pt; border-radius: 4pt; font-weight: bold; font-size: 7.5pt; }
    .badge-sig { background-color: #10b981; color: #ffffff; padding: 2.5pt 6pt; border-radius: 4pt; font-weight: bold; font-size: 7.5pt; }
  </style>
</head>
<body>
  <!-- 1. Position Absolute Rotated Watermark -->
  <div style="position: absolute; top: 340pt; left: 30pt; transform: rotate(-35deg); opacity: 0.12; font-size: 32pt; font-weight: bold; color: #475569; z-index: 0; pointer-events: none;">
    CONFIDENTIAL · ISO-32000 VERIFIED
  </div>

  <!-- Header Box with Inline SVG Vector Emblem & X.509 Badge -->
  <div class="header-box flex justify-between items-center">
    <div class="flex items-center gap-3">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #38bdf8;">
        <path d="M 12 2 A 10 10 0 1 1 2 12 A 10 10 0 0 1 12 2 Z"/>
        <path d="M 12 6 V 12 L 16 14"/>
      </svg>
      <div>
        <div class="text-xl font-bold text-white">{{.PortfolioTitle}}</div>
        <div class="text-xs text-slate-300">{{.Desk}} · {{.AttestationId}}</div>
      </div>
    </div>
    <div class="text-right">
      <div class="badge-sig">X.509 DIGITAL SIGNED</div>
      <div class="text-xs text-slate-300 mt-1">{{.Timestamp}}</div>
    </div>
  </div>

  <!-- 2. calc(100% - 20pt) Layout Box with Multi-Currency Unicode Symbols ($, €, £, ₹, ¥) -->
  <div style="width: calc(100% - 20pt); margin: 0 auto 8pt auto; padding: 6pt 10pt; background: #f8fafc; border: 1pt solid #cbd5e1; border-radius: 6pt; font-size: 8pt;">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div><b>Multi-Currency Liquidity Pool:</b></div>
      <div>USD: <span style="font-weight: bold; color: #4f46e5;">{{.TotalNotionalUSD}}</span></div>
      <div>EUR: <span style="font-weight: bold; color: #4f46e5;">{{.EurTotal}}</span></div>
      <div>GBP: <span style="font-weight: bold; color: #4f46e5;">{{.GbpTotal}}</span></div>
      <div>INR: <span style="font-weight: bold; color: #4f46e5;">{{.InrTotal}}</span></div>
      <div>JPY: <span style="font-weight: bold; color: #4f46e5;">{{.JpyTotal}}</span></div>
    </div>
  </div>
  <div style="border-left: 3pt solid #4f46e5; background: #f8fafc; padding: 6pt 10pt; margin-bottom: 8pt; border-radius: 0 4pt 4pt 0; box-shadow: 0 1pt 3pt rgba(0,0,0,0.05); font-size: 8pt;">
    <div style="font-weight: bold; color: #1e1b4b;">Regulatory Basel III / Dodd-Frank Attestation Notice</div>
    <div style="color: #64748b; font-size: 7.5pt; margin-top: 1pt;">
      All derivative valuation exposures calculated via deterministic Monte Carlo VaR models. Cryptographically certified under PAdES ISO 32000-1 specifications.
    </div>
  </div>


  <!-- 3. Matrix Table: Both rowspan="2" and colspan="2" + tfoot summary + inline badges -->
  <table>
    <thead>
      <tr>
        <th rowspan="2">Asset Class</th>
        <th colspan="2">Instrument Specification</th>
        <th rowspan="2" class="center">Ccy</th>
        <th rowspan="2" class="num">Gross Notional</th>
        <th rowspan="2" class="num">VaR (99%)</th>
        <th rowspan="2" class="num">Margin</th>
        <th rowspan="2" class="center">Status</th>
      </tr>
      <tr>
        <th>Contract / Underlier</th>
        <th>Tenor</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td rowspan="2">
          <b>Credit Default Swaps</b><br>
          <span style="color:#64748b;font-size:7.5pt">Senior Index Tranche · Mark-to-Market</span>
        </td>
        <td>
          <b>iTraxx Europe Crossover S42</b><br>
          <span style="color:#64748b;font-size:7.5pt">Underlier: 75 High-Yield European Corporate Credits</span>
        </td>
        <td>5Y</td>
        <td class="center">€</td>
        <td class="num">€420,000,000</td>
        <td class="num">€14.2M</td>
        <td class="num">99.4%</td>
        <td class="center"><span class="badge-pass">VERIFIED</span></td>
      </tr>
      <tr>
        <td>CDX North American High Yield</td>
        <td>10Y</td>
        <td class="center">$</td>
        <td class="num">$380,000,000</td>
        <td class="num">$18.5M</td>
        <td class="num">98.8%</td>
        <td class="center"><span class="badge-pass">VERIFIED</span></td>
      </tr>
      <tr>
        <td rowspan="2"><b>Interest Rate Swaptions</b></td>
        <td>EURIBOR 3M / SOFR Basis Swap</td>
        <td>2Y</td>
        <td class="center">€</td>
        <td class="num">€265,000,000</td>
        <td class="num">€6.8M</td>
        <td class="num">99.9%</td>
        <td class="center"><span class="badge-opt">OPTIMAL</span></td>
      </tr>
      <tr>
        <td>SONIA / Sterling Overnight Index</td>
        <td>5Y</td>
        <td class="center">£</td>
        <td class="num">£190,000,000</td>
        <td class="num">£5.4M</td>
        <td class="num">99.1%</td>
        <td class="center"><span class="badge-opt">OPTIMAL</span></td>
      </tr>
      <tr>
        <td rowspan="2"><b>FX Cross-Parity</b></td>
        <td>USD / INR Forward Parity</td>
        <td>1Y</td>
        <td class="center">₹</td>
        <td class="num">₹48,500,000,000</td>
        <td class="num">₹1,250M</td>
        <td class="num">97.6%</td>
        <td class="center"><span class="badge-attn">ATTENDED</span></td>
      </tr>
      <tr>
        <td>JPY / USD Zero-Coupon Strip</td>
        <td>3Y</td>
        <td class="center">¥</td>
        <td class="num">¥85,000,000,000</td>
        <td class="num">¥2,100M</td>
        <td class="num">98.5%</td>
        <td class="center"><span class="badge-pass">VERIFIED</span></td>
      </tr>
    </tbody>
    <tfoot>
      <tr>
        <td colspan="4">Aggregate Net Derivatives Exposure (USD Equiv)</td>
        <td class="num">$1,482,900,000</td>
        <td class="num">$44.9M</td>
        <td class="num">98.9%</td>
        <td class="center font-bold" style="color: #166534;">100% AUDITED</td>
      </tr>
    </tfoot>
  </table>

  <!-- 4. Multi-Series Canvas2D Chart with setLineDash([4, 3]) + Bezier Curves, plus Barcode & QR -->
  <div style="display: grid; grid-template-columns: 225pt 155pt 1fr; gap: 12pt; align-items: center; margin-top: 6pt; padding: 6pt 10pt; background: #f8fafc; border: 1pt solid #e2e8f0; border-radius: 6pt;">
    <div>
      <div style="font-size: 8pt; font-weight: bold; color: #0f172a; margin-bottom: 2pt;">
        Risk Surface & Liquidity Trajectory (Canvas2D Bezier Vectors)
      </div>
      <canvas id="stress-chart" width="280" height="72"></canvas>
    </div>
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3pt;">
      <div style="font-size: 7pt; color: #64748b; font-weight: bold;">ISO CODE 128</div>
      <barcode value="VX-DERIV-2026-X9921" width="130" height="34" showLabel="true"></barcode>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 7pt; color: #64748b; font-weight: bold; margin-bottom: 2pt;">ISO REED-SOLOMON QR</div>
      <qr value="https://veloxpdf.dev/verify/derivatives-portfolio-attestation-2026-q4-iso32000-sha256-pkcs7?audit=x9921&reg=cftc-esma-bis&client=tier1-clearing" size="64"></qr>
    </div>
  </div>

  <p style="font-size: 7.5pt; color: #64748b; margin-top: 5pt; text-align: center;">
    Cryptographic Attestation ID <code>{{.AttestationId}}</code> · Compliant with ISO 32000-1 AcroForm X.509 PKCS#7 · Verified in &lt;3ms
  </p>

  <script>
    const c = document.getElementById('stress-chart');
    if (c && c.getContext) {
      const ctx = c.getContext('2d');
      // 1. Gridlines with setLineDash([4, 3])
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([4, 3]);
      for (let y = 14; y <= 58; y += 14) {
        ctx.beginPath();
        ctx.moveTo(8, y);
        ctx.lineTo(272, y);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // 2. Multi-series Smooth Bezier Curves
      // Series A: Value at Risk (VaR 99%)
      ctx.strokeStyle = '#4f46e5';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(12, 54);
      ctx.bezierCurveTo(60, 58, 90, 18, 140, 30);
      ctx.bezierCurveTo(190, 42, 230, 12, 268, 16);
      ctx.stroke();

      // Series B: Liquidity Coverage Ratio (LCR)
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(12, 42);
      ctx.bezierCurveTo(55, 28, 100, 48, 145, 36);
      ctx.bezierCurveTo(190, 24, 235, 46, 268, 34);
      ctx.stroke();

      // Series C: Margin Threshold
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(12, 26);
      ctx.bezierCurveTo(70, 20, 130, 24, 180, 22);
      ctx.bezierCurveTo(220, 20, 250, 25, 268, 22);
      ctx.stroke();

      // Axis labels
      ctx.fillStyle = '#64748b';
      ctx.fillText('Q1', 12, 68);
      ctx.fillText('Q2', 76, 68);
      ctx.fillText('Q3', 140, 68);
      ctx.fillText('Q4', 204, 68);
      ctx.fillText('EST', 252, 68);
    }
  </script>
</body>
</html>`,
  },
};

// JIT Warmup: 5 iterations so the very first Studio render is already JIT-warmed (<1.8ms)
try {
  const warmupTpl = PRESETS.invoice?.template;
  const warmupData = PRESETS.invoice?.data;
  if (warmupTpl && warmupData) {
    for (let i = 0; i < 5; i++) {
      htmlToPdf(warmupTpl, { data: warmupData, sign: defaultCert, compress: false });
    }
  }
} catch {
  // Ignore warmup error
}

// 100 Realistic Enterprise Customers for Mail-Merge Batching & Flipbook
export const ENTERPRISE_CUSTOMERS = [
  { name: 'Acme Robotics Corp', address: '742 Evergreen Terrace, San Francisco, CA 94107', pay: 'Instant ACH · ISO-20022-RTP' },
  { name: 'Stripe Technologies Inc', address: '354 Oyster Point Blvd, South San Francisco, CA 94080', pay: 'FedNow Real-Time Settlement' },
  { name: 'Cloudflare Edge Systems', address: '101 Townsend St, San Francisco, CA 94107', pay: 'Wire Transfer · SWIFT GPI' },
  { name: 'Datadog Observability Corp', address: '620 8th Ave, 45th Floor, New York, NY 10018', pay: 'Corporate P-Card · Visa Business' },
  { name: 'Snowflake Cloud Data Inc', address: '106 East Babcock St, Bozeman, MT 59715', pay: 'Instant ACH · ISO-20022-RTP' },
  { name: 'Anthropic AI PBC', address: '500 Howard St, San Francisco, CA 94105', pay: 'FedNow Real-Time Settlement' },
  { name: 'Supabase Open Source Inc', address: '970 Folsom St, San Francisco, CA 94107', pay: 'Corporate P-Card · Visa Business' },
  { name: 'Vercel Edge Platform', address: '340 S Lemon Ave #4133, Walnut, CA 91789', pay: 'Instant ACH · ISO-20022-RTP' },
  { name: 'PostHog Product Analytics', address: '2261 Market St #4008, San Francisco, CA 94114', pay: 'Wire Transfer · SWIFT GPI' },
  { name: 'Linear Systems Inc', address: '548 Market St #31942, San Francisco, CA 94104', pay: 'Instant ACH · ISO-20022-RTP' },
  { name: 'Retool Developer Tools', address: '1550 Bryant St #200, San Francisco, CA 94103', pay: 'FedNow Real-Time Settlement' },
  { name: 'Ramp Financial Corp', address: '28 W 23rd St, 10th Floor, New York, NY 10010', pay: 'Instant ACH · ISO-20022-RTP' },
  { name: 'Brex Global Systems', address: '1283 Howard St, San Francisco, CA 94103', pay: 'Corporate P-Card · Visa Business' },
  { name: 'Deel Global Payroll Corp', address: '425 2nd St, San Francisco, CA 94107', pay: 'Wire Transfer · SWIFT GPI' },
  { name: 'Rippling People Center', address: '55 2nd St, Suite 2100, San Francisco, CA 94105', pay: 'FedNow Real-Time Settlement' },
  { name: 'Plaid Financial APIs', address: '1098 Harrison St, San Francisco, CA 94103', pay: 'Instant ACH · ISO-20022-RTP' },
  { name: 'Databricks Lakehouse Inc', address: '160 Spear St, 13th Floor, San Francisco, CA 94105', pay: 'Wire Transfer · SWIFT GPI' },
  { name: 'Palantir Technologies', address: '1555 Blake St, Suite 250, Denver, CO 80202', pay: 'FedNow Real-Time Settlement' },
  { name: 'MongoDB Atlas Cloud', address: '1633 Broadway, 38th Floor, New York, NY 10019', pay: 'Instant ACH · ISO-20022-RTP' },
  { name: 'GitLab Global DevOps', address: '268 Bush St #350, San Francisco, CA 94104', pay: 'Corporate P-Card · Visa Business' },
  { name: 'HashiCorp Cloud Platform', address: '101 2nd St, Suite 700, San Francisco, CA 94105', pay: 'Instant ACH · ISO-20022-RTP' },
  { name: 'Notion Workspace Labs', address: '548 Market St #74512, San Francisco, CA 94104', pay: 'Corporate P-Card · Visa Business' },
  { name: 'Figma Collaborative UI', address: '760 Market St, Floor 10, San Francisco, CA 94102', pay: 'Instant ACH · ISO-20022-RTP' },
  { name: 'Scale AI Foundation', address: '155 5th St, San Francisco, CA 94103', pay: 'Wire Transfer · SWIFT GPI' },
  { name: 'Snyk Developer Security', address: '100 Summer St, 7th Floor, Boston, MA 02110', pay: 'FedNow Real-Time Settlement' },
  { name: 'Wiz Cloud Security Inc', address: '115 Broadway, 5th Floor, New York, NY 10006', pay: 'Corporate P-Card · Visa Business' },
  { name: 'CrowdStrike Falcon Tech', address: '206 E 9th St, Suite 1400, Austin, TX 78701', pay: 'Instant ACH · ISO-20022-RTP' },
  { name: 'CloudZero Cloud Cost Intelligence', address: '280 Summer St, 5th Floor, Boston, MA 02210', pay: 'FedNow Real-Time Settlement' },
  { name: 'Grafana Labs Observability', address: '240 Richmond St W, Toronto, ON M5V 1V6', pay: 'Wire Transfer · SWIFT GPI' },
  { name: 'Splunk Big Data Systems', address: '270 Brannan St, San Francisco, CA 94107', pay: 'Instant ACH · ISO-20022-RTP' },
  { name: 'Okta Identity Cloud', address: '100 1st St, Suite 600, San Francisco, CA 94105', pay: 'Corporate P-Card · Visa Business' },
  { name: 'Fastly Edge Cloud CDN', address: '475 Brannan St #300, San Francisco, CA 94107', pay: 'FedNow Real-Time Settlement' },
  { name: 'Shopify Global Commerce', address: "151 O'Connor St, Ottawa, ON K2P 2L8", pay: 'Instant ACH · ISO-20022-RTP' },
  { name: 'Coinbase Prime Institutional', address: '100 Pine St, Suite 1250, San Francisco, CA 94111', pay: 'Wire Transfer · SWIFT GPI' },
  { name: 'Robinhood Markets Inc', address: '85 Willow Rd, Menlo Park, CA 94025', pay: 'FedNow Real-Time Settlement' },
  { name: 'Twilio Communications Cloud', address: '101 Spear St, 1st Floor, San Francisco, CA 94105', pay: 'Corporate P-Card · Visa Business' },
  { name: 'SendGrid Email Delivery', address: '1401 Lawrence St, Suite 1000, Denver, CO 80202', pay: 'Instant ACH · ISO-20022-RTP' },
  { name: 'DoorDash Logistics Cloud', address: '303 2nd St, South Tower, San Francisco, CA 94107', pay: 'FedNow Real-Time Settlement' },
  { name: 'Uber Freight Technologies', address: '1725 3rd St, San Francisco, CA 94158', pay: 'Corporate P-Card · Visa Business' },
  { name: 'Airbnb Global Stays Inc', address: '888 Brannan St, San Francisco, CA 94103', pay: 'Instant ACH · ISO-20022-RTP' },
];

export function getEnterpriseCustomer(i) {
  if (i < ENTERPRISE_CUSTOMERS.length) return ENTERPRISE_CUSTOMERS[i];
  const hubs = ['San Francisco, CA', 'New York, NY', 'Austin, TX', 'Seattle, WA', 'London, UK', 'Berlin, DE', 'Tokyo, JP', 'Singapore, SG'];
  const methods = ['Instant ACH · ISO-20022-RTP', 'FedNow Real-Time Settlement', 'Wire Transfer · SWIFT GPI', 'Corporate P-Card · Visa Business'];
  return {
    name: `Enterprise Partner #${i + 1} Corp`,
    address: `${100 + ((i * 17) % 900)} Innovation Way, ${hubs[i % hubs.length]}`,
    pay: methods[i % methods.length],
  };
}

export function generateEnterpriseInvoiceData(baseData, i) {
  const cust = getEnterpriseCustomer(i);
  const invNum = `INV-2026-${String(99400 + i).padStart(5, '0')}`;
  const day = Math.max(1, 28 - (i % 28));
  const date = `${day} Oct 2026`;
  const grandTotalNum = 12000 + ((i * 347) % 68000);
  const grandTotal = `$${grandTotalNum.toLocaleString('en-US')}.00`;

  const cloned = JSON.parse(JSON.stringify(baseData || {}));
  cloned.CustomerName = cust.name;
  cloned.CustomerAddress = cust.address;
  cloned.PaymentMethod = cust.pay;
  cloned.InvoiceNumber = invNum;
  cloned.Date = date;
  cloned.GrandTotal = grandTotal;

  if (Array.isArray(cloned.Items) && cloned.Items.length > 0) {
    const nItems = cloned.Items.length;
    const baseShare = Math.floor(grandTotalNum / nItems);
    let rem = grandTotalNum;
    for (let k = 0; k < nItems; k++) {
      const isLast = (k === nItems - 1);
      const itemTotal = isLast ? rem : baseShare;
      rem -= itemTotal;
      cloned.Items[k].Total = `$${itemTotal.toLocaleString('en-US')}.00`;
      cloned.Items[k].Price = `$${itemTotal.toLocaleString('en-US')}.00`;
      cloned.Items[k].Qty = '1';
    }
  }

  return cloned;
}

export function jsonToCsv(data) {
  if (!data) return '';
  let arr = null;
  if (Array.isArray(data)) {
    arr = data;
  } else if (typeof data === 'object') {
    const preferredKeys = ['Items', 'items', 'lines', 'entries', 'data', 'rows'];
    for (const key of preferredKeys) {
      if (Array.isArray(data[key])) {
        arr = data[key];
        break;
      }
    }
    if (!arr) {
      for (const val of Object.values(data)) {
        if (Array.isArray(val) && val.length > 0) {
          arr = val;
          break;
        }
      }
    }
    if (!arr) {
      const keys = Object.keys(data).filter((k) => typeof data[k] !== 'object');
      if (keys.length > 0) {
        return (
          keys.join(',') +
          '\n' +
          keys.map((k) => `"${String(data[k] ?? '').replace(/"/g, '""')}"`).join(',')
        );
      }
      return '';
    }
  }
  if (!arr || arr.length === 0) return '';
  const keysSet = new Set();
  for (const item of arr) {
    if (item && typeof item === 'object') {
      for (const k of Object.keys(item)) keysSet.add(k);
    }
  }
  const headers = [...keysSet];
  if (headers.length === 0) return '';
  const lines = [headers.join(',')];
  for (const item of arr) {
    const row = headers.map((h) => {
      const val = item?.[h] != null ? String(item[h]) : '';
      return `"${val.replace(/"/g, '""')}"`;
    });
    lines.push(row.join(','));
  }
  return lines.join('\n');
}

let lastBatchCompiler = null;
let lastBatchResults = null;
let lastBatchBaseData = null;
let lastBatchTemplate = null;

export function createServer(customPort = PORT) {
  const srv = http.createServer((req, res) => {
    // CORS headers for studio or external integrations
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    // GET /api/defaults & GET /api/presets
    if (req.method === 'GET' && (url.pathname === '/api/defaults' || url.pathname === '/api/presets')) {
      const selectedId = url.searchParams.get('preset') || 'invoice';
      const preset = PRESETS[selectedId] || PRESETS.invoice;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          preset: selectedId,
          template: preset.template.trim(),
          data: preset.data,
          format: preset.format,
          sign: preset.sign,
          headerText: preset.headerText || '',
          footerText: preset.footerText || '',
          allPresets: Object.keys(PRESETS).map((key) => ({
            id: key,
            name: PRESETS[key].name,
            category: PRESETS[key].category,
            format: PRESETS[key].format,
          })),
        }),
      );
      return;
    }

    // POST /api/render
    if (req.method === 'POST' && url.pathname === '/api/render') {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          let dataObj = {};
          if (body.data) {
            dataObj = typeof body.data === 'string' ? JSON.parse(body.data) : body.data;
          }

          const t0 = performance.now();
          const renderOpts = {
            data: dataObj,
            format: body.format || 'A4',
            singlePage: Boolean(body.singlePage),
            compress: body.compress !== false,
            headerText: body.headerText || undefined,
            footerText: body.footerText || undefined,
            visualSeal: body.sign ? true : (body.visualSeal === true ? true : false),
            sign: false,
            returnMetrics: true,
          };

          const result = htmlToPdf(body.html || '', renderOpts);
          const renderMs = performance.now() - t0;

          let finalBytes = result.pdfBytes;
          let signMs = 0;
          let signatureInfo = null;

          if (body.sign) {
            const ts0 = performance.now();
            finalBytes = signPdf(finalBytes, {
              certPem: defaultCert.certPem,
              keyPem: defaultCert.keyPem,
              signerName: body.signerName || 'VeloxPDF Treasury Authority',
              reason: body.reason || 'Cryptographic Document Attestation',
              location: body.location || 'San Francisco, US',
            });
            signMs = performance.now() - ts0;

            try {
              signatureInfo = verifyPdfSignature(finalBytes);
            } catch (sigErr) {
              signatureInfo = { valid: false, error: String(sigErr?.message || sigErr) };
            }
          }

          const pdfBase64 = Buffer.from(finalBytes).toString('base64');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              pdfBase64,
              renderMs: +renderMs.toFixed(3),
              signMs: +signMs.toFixed(3),
              sizeBytes: finalBytes.byteLength,
              byteLength: finalBytes.byteLength,
              pages: result.pageCount || 1,
              pageCount: result.pageCount || 1,
              signatureInfo,
              verification: signatureInfo,
            }),
          );
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(err?.message || err) }));
        }
      });
      return;
    }

    // POST /api/verify
    if (req.method === 'POST' && url.pathname === '/api/verify') {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (!body.pdfBase64) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'pdfBase64 is required' }));
            return;
          }

          const pdfBuf = Buffer.from(body.pdfBase64, 'base64');
          const tamper1Byte = Boolean(body.tamper1Byte);
          let tamperOffset = null;

          if (tamper1Byte) {
            // Tamper 1 single byte in the signed PDF header / content stream to prove cryptographic rejection
            tamperOffset = typeof body.tamperOffset === 'number' ? body.tamperOffset : 32;
            if (tamperOffset >= pdfBuf.length) tamperOffset = pdfBuf.length - 10;
            pdfBuf[tamperOffset] ^= 0x55; // Flip bits in that byte
          }

          const t0 = performance.now();
          const verification = verifyPdfSignature(pdfBuf);
          const verifyMs = +(performance.now() - t0).toFixed(3);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              valid: Boolean(verification.valid),
              tampered: tamper1Byte,
              tamperOffset,
              verifyMs,
              signerName: verification.signerName || 'Unknown',
              reason: verification.reason || '',
              location: verification.location || '',
              signedAt: verification.signedAt || verification.signingTime || '',
              digestHex: verification.digestHex || '',
              byteRange: verification.byteRange || null,
              sha256Fingerprint: verification.sha256Fingerprint || null,
              subFilter: verification.subFilter || 'adbe.pkcs7.detached',
              error: verification.error || (verification.valid ? null : 'Cryptographic digest mismatch: content was altered after signing'),
              details: verification,
            }),
          );
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(err?.message || err) }));
        }
      });
      return;
    }

    // POST /api/benchmark
    if (req.method === 'POST' && url.pathname === '/api/benchmark') {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        try {
          const body = chunks.length > 0 ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
          const iterations = Math.min(200, Math.max(10, body.iterations || 40));

          const template = body.html || PRESETS.invoice.template;
          const data = body.data || PRESETS.invoice.data;

          // 1. Cold Render
          const tCold0 = performance.now();
          htmlToPdf(template, { data, format: 'A4', sign: false, compress: false });
          const veloxColdMs = +(performance.now() - tCold0).toFixed(3);

          // 2. Warmup JIT
          for (let i = 0; i < 8; i++) {
            htmlToPdf(template, { data, format: 'A4', sign: false, compress: false });
          }

          // 3. Warm Benchmark (N iterations)
          const warmTimes = [];
          for (let i = 0; i < iterations; i++) {
            const t0 = performance.now();
            htmlToPdf(template, { data, format: 'A4', sign: false, compress: false });
            warmTimes.push(performance.now() - t0);
          }
          warmTimes.sort((a, b) => a - b);
          const warmP50 = +warmTimes[Math.floor(warmTimes.length * 0.5)].toFixed(3);
          const warmP95 = +warmTimes[Math.floor(warmTimes.length * 0.95)].toFixed(3);
          const warmAvg = warmTimes.reduce((acc, v) => acc + v, 0) / warmTimes.length;
          const veloxPagesPerSec = Math.round(1000 / Math.max(0.001, warmAvg));

          // 4. Futamura Parametric Compiler Benchmark
          const compiled = compilePdfTemplate(template, data);
          // Warmup parametric
          for (let i = 0; i < 8; i++) {
            compiled(data);
          }
          const parametricTimes = [];
          for (let i = 0; i < iterations; i++) {
            const t0 = performance.now();
            compiled(data);
            parametricTimes.push(performance.now() - t0);
          }
          parametricTimes.sort((a, b) => a - b);
          const parametricP50 = +parametricTimes[Math.floor(parametricTimes.length * 0.5)].toFixed(3);
          const parametricP95 = +parametricTimes[Math.floor(parametricTimes.length * 0.95)].toFixed(3);
          const parametricAvg = parametricTimes.reduce((acc, v) => acc + v, 0) / parametricTimes.length;
          const parametricPagesPerSec = Math.round(1000 / Math.max(0.001, parametricAvg));

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              iterations,
              veloxColdMs,
              veloxWarmP50Ms: warmP50,
              veloxWarmP95Ms: warmP95,
              veloxPagesPerSec,
              veloxParametricP50Ms: parametricP50,
              veloxParametricP95Ms: parametricP95,
              veloxParametricPagesPerSec: parametricPagesPerSec,
            }),
          );
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(err?.message || err) }));
        }
      });
      return;
    }
    // GET /api/batch & GET /api/batch/sample (on-demand flipbook scrub / inspection)
    if (req.method === 'GET' && (url.pathname === '/api/batch' || url.pathname === '/api/batch/sample')) {
      const idxParam = url.searchParams.get('index') ?? url.searchParams.get('idx');
      if (idxParam != null) {
        const idx = Math.max(0, parseInt(idxParam, 10) || 0);
        if (lastBatchResults && lastBatchResults[idx]) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, index: idx, sample: lastBatchResults[idx] }));
          return;
        }
        if (lastBatchCompiler) {
          const row = generateEnterpriseInvoiceData(lastBatchBaseData || PRESETS.invoice.data, idx);
          const pdfBytes = lastBatchCompiler(row);
          const sample = {
            index: idx,
            customerName: row.CustomerName,
            invoiceNumber: row.InvoiceNumber,
            date: row.Date,
            paymentMethod: row.PaymentMethod,
            grandTotal: row.GrandTotal,
            pdfBase64: Buffer.from(pdfBytes).toString('base64'),
            sizeBytes: pdfBytes.length,
          };
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, index: idx, sample }));
          return;
        }
      }
    }

    // POST /api/batch
    if (req.method === 'POST' && url.pathname === '/api/batch') {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        try {
          const body = chunks.length > 0 ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};

          // If requesting an individual index on-demand from previous batch
          if (body.index !== undefined && !body.html) {
            const idx = Math.max(0, parseInt(body.index, 10) || 0);
            if (lastBatchResults && lastBatchResults[idx]) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true, index: idx, sample: lastBatchResults[idx] }));
              return;
            }
            if (lastBatchCompiler) {
              const row = generateEnterpriseInvoiceData(lastBatchBaseData || PRESETS.invoice.data, idx);
              const pdfBytes = lastBatchCompiler(row);
              const sample = {
                index: idx,
                customerName: row.CustomerName,
                invoiceNumber: row.InvoiceNumber,
                date: row.Date,
                paymentMethod: row.PaymentMethod,
                grandTotal: row.GrandTotal,
                pdfBase64: Buffer.from(pdfBytes).toString('base64'),
                sizeBytes: pdfBytes.length,
              };
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true, index: idx, sample }));
              return;
            }
          }

          const template = body.html || PRESETS.invoice.template;
          let baseData = body.baseData;
          if (!baseData) baseData = PRESETS.invoice.data;
          else if (typeof baseData === 'string') {
            try {
              baseData = JSON.parse(baseData);
            } catch {}
          }
          const count = Math.min(500, Math.max(1, +(body.count || 100)));

          const tCompile0 = performance.now();
          const compiled = compilePdfTemplate(template, baseData);
          const compileSetupMs = performance.now() - tCompile0;

          const tBatch0 = performance.now();
          const results = [];
          for (let i = 0; i < count; i++) {
            const row = generateEnterpriseInvoiceData(baseData, i);
            const pdfBytes = compiled(row);
            const pdfBase64 = Buffer.from(pdfBytes).toString('base64');
            results.push({
              index: i,
              customerName: row.CustomerName,
              invoiceNumber: row.InvoiceNumber,
              date: row.Date,
              paymentMethod: row.PaymentMethod,
              grandTotal: row.GrandTotal,
              pdfBase64,
              sizeBytes: pdfBytes.length,
            });
          }
          const batchExecMs = performance.now() - tBatch0;

          lastBatchCompiler = compiled;
          lastBatchResults = results;
          lastBatchBaseData = baseData;
          lastBatchTemplate = template;

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              ok: true,
              count,
              compileSetupMs: +compileSetupMs.toFixed(3),
              totalMs: +batchExecMs.toFixed(3),
              perDocUs: +((batchExecMs * 1000) / count).toFixed(2),
              pagesPerSec: Math.round((count * 1000) / Math.max(0.01, batchExecMs)),
              samples: results.slice(0, 20).map((r) => ({
                index: r.index,
                customerName: r.customerName,
                invoiceNumber: r.invoiceNumber,
                date: r.date,
                paymentMethod: r.paymentMethod,
                grandTotal: r.grandTotal,
                pdfBase64: r.pdfBase64,
                sizeBytes: r.sizeBytes,
              })),
              items: results.map((r) => ({
                index: r.index,
                customerName: r.customerName,
                invoiceNumber: r.invoiceNumber,
                date: r.date,
                paymentMethod: r.paymentMethod,
                grandTotal: r.grandTotal,
                sizeBytes: r.sizeBytes,
              })),
            }),
          );
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(err?.message || err) }));
        }
      });
      return;
    }

    // POST /api/inspect-pdf
    if (req.method === 'POST' && url.pathname === '/api/inspect-pdf') {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (!body.pdfBase64) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'pdfBase64 is required' }));
            return;
          }

          const pdfBuf = Buffer.from(body.pdfBase64, 'base64');
          const fileName = body.fileName || 'document.pdf';

          let verification = null;
          try {
            verification = verifyPdfSignature(pdfBuf);
          } catch (verErr) {
            verification = { valid: false, error: String(verErr?.message || verErr) };
          }

          let embeddedData = null;
          try {
            embeddedData = extractEmbeddedData(pdfBuf);
          } catch (extErr) {
            embeddedData = null;
          }

          const csvText = jsonToCsv(embeddedData);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              ok: true,
              fileName,
              sizeBytes: pdfBuf.length,
              verification,
              embeddedData,
              hasEmbeddedData: Boolean(embeddedData),
              csvText,
            }),
          );
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(err?.message || err) }));
        }
      });
      return;
    }

    // Static files: serve public/index.html or static files
    let reqPath = url.pathname === '/' ? '/index.html' : url.pathname;
    const filePath = path.join(PUBLIC_DIR, path.normalize(reqPath));

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.png': 'image/png',
        '.svg': 'image/svg+xml',
        '.pdf': 'application/pdf',
      };
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    // Fallback: serve index.html for SPA
    const indexFile = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(indexFile)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(indexFile).pipe(res);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  return {
    server: srv,
    listen: (port = customPort, cb) => {
      // Bind to loopback only by default. The Studio renders arbitrary HTML
      // (including <script>) supplied over /api/render, which is NOT a security
      // boundary, so it must never be exposed on untrusted interfaces. A deployer
      // who understands the risk can opt into a wider bind via VELOX_HOST.
      const host = process.env.VELOX_HOST || '127.0.0.1';
      srv.listen(port, host, () => {
        if (cb) cb(port);
        else console.log(`VeloxPDF Studio live at http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}`);
      });
      return srv;
    },
  };
}

// Auto-start if executed directly
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const app = createServer(PORT);
  app.listen(PORT, (p) => {
    console.log(`\x1b[32m✔\x1b[0m VeloxPDF Studio live at http://127.0.0.1:${p}`);
    console.log(`  Zero-Chromium HTML/CSS/Tailwind/Canvas2D to Signed PDF 1.7`);
  });
}

export default createServer;
