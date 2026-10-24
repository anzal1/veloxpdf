#!/usr/bin/env node
// Builds scripts/fidelity/fixtures/*.html from local clones of the open-source templates.
//   node scripts/fidelity/prepare-fixtures.mjs <dir with the cloned repos>
// Clones are expected as <dir>/<owner>_<repo>. The commit and licence of every source is in
// fixtures/SOURCES.md. What this script changes in a template, nothing else:
//   - [[placeholders]] (tociva) or {{placeholders}} (sparksuite) are filled with the sample data below
//   - remote <link rel=stylesheet> (Google Fonts) is removed, so both engines use the same fallback font
//   - logo images point at the local placeholder-logo.png
//   - a licence comment is put at the top of the file
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileTemplate } from '../../src/dom-vm.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'fixtures');
const SRC = process.argv[2];
if (!SRC) { console.error('usage: prepare-fixtures.mjs <clones dir>'); process.exit(1); }

const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');
const licenceLine = (repoDir) => fs.readFileSync(path.join(SRC, repoDir, fs.readdirSync(path.join(SRC, repoDir)).find((f) => /^licen[sc]e/i.test(f))), 'utf8').split('\n').find((l) => /copyright/i.test(l)).trim();

function items(n) {
  const names = ['Website design', 'Hosting (3 months)', 'Domain name (1 year)', 'Logo refresh', 'Monthly maintenance', 'Photography session', 'Copywriting, 4 pages', 'Cloud storage 500 GB', 'Support retainer', 'Training workshop'];
  return Array.from({ length: n }, (_, i) => {
    const q = (i % 4) + 1; const p = 25 + ((i * 37) % 180);
    return { item_name: names[i % names.length] + (i >= names.length ? ` #${Math.floor(i / names.length) + 1}` : ''), item_quantity: String(q), item_price: p.toFixed(2), item_cgst: (p * q * 0.09).toFixed(2), item_sgst: (p * q * 0.09).toFixed(2), item_igst: '0.00', item_amount: (p * q).toFixed(2) };
  });
}
const BASE = {
  currency_symbol: '$', org_name: 'Northwind Studio', org_email: 'billing@northwind.example', org_phone: '+1 555 0100', org_address: '12345 Sunny Road, Sunnyville, CA 12345', org_website: 'northwind.example',
  customer_name: 'Acme Corp.', customer_address: '742 Evergreen Terrace, Springfield', customer_phone: '+1 555 0142', customer_email: 'jane@acme.example',
  invoice_number: 'INV-2026-0412', invoice_date: 'October 24, 2026', payment_due_date: 'November 24, 2026',
  itemtotal: '385.00', discount: '15.00', subtotal: '370.00', tax_amount: '33.30', roundoff: '0.00', grand_total: '403.30', shipping: '0.00', grand_total_inwords: 'Four hundred three dollars and thirty cents',
  terms_and_conditions: 'Payment is due within 30 days. Late payments may incur a 1.5% monthly fee.', notes: 'Thank you for your business.',
  bank_name: 'First Example Bank', account_name: 'Northwind Studio LLC', account_number: '0123456789', bank_account_name: 'Northwind Studio LLC', bank_account_number: '0123456789', bank_account_no: '0123456789', bank_ifsc: 'EXMP0001234', account_holder: 'Northwind Studio LLC', paypal_email: 'pay@northwind.example', payment_info: 'Bank transfer',
  org_authority_name: 'Jane Roe', org_authority_designation: 'Finance Manager', signature_name: 'Jane Roe', signature_title: 'Finance', account_manager_name: 'Sam Lee',
  logo_small_src: 'placeholder-logo.png', logo_large_src: 'placeholder-logo.png', mail_logo_src: 'placeholder-logo.png', signature: '', NAME: 'Jane Roe', Designation: 'Finance Manager',
};
function fillBrackets(html, nItems) {
  const rows = items(nItems);
  html = html.replace(/\[\[items_start\]\]([\s\S]*?)\[\[items_end\]\]/g, (_, block) => rows.map((r) => block.replace(/\[\[(\w+)\]\]/g, (m, k) => (k in r ? r[k] : (k in BASE ? BASE[k] : '')))).join(''));
  return html.replace(/\[\[(\w+)\]\]/g, (m, k) => (k in BASE ? BASE[k] : ''));
}
const stripRemoteLinks = (html) => html.replace(/<link\b[^>]*rel=["']?stylesheet["']?[^>]*>/gi, (m) => (/https?:\/\//i.test(m) ? '' : m)).replace(/<link\b[^>]*https?:\/\/[^>]*>/gi, '');
const swapImages = (html) => html.replace(/(<img\b[^>]*?\bsrc=)(["'])[^"']*\2/gi, '$1$2placeholder-logo.png$2');

const tociva = 'tociva_free-invoice-generator/public/invoice-templates/';
const specs = [
  { name: 'sparksuite-plain', repo: 'sparksuite_simple-html-invoice-template', file: 'sparksuite_simple-html-invoice-template/invoice.html', style: 'table, classic', custom: (html) => compileTemplate(html, { Company: 'Northwind Studio', CompanyStreet: '12345 Sunny Road', CompanyCity: 'Sunnyville, CA 12345', InvoiceNumber: 'INV-2026-0412', Created: 'October 24, 2026', Due: 'November 24, 2026', CustomerName: 'Acme Corp.', CustomerContact: 'Jane Doe', CustomerEmail: 'jane@example.com', PaymentMethod: 'Bank transfer', CheckNumber: '1000', Items: [{ Name: 'Website design', Price: '$300.00' }, { Name: 'Hosting (3 months)', Price: '$75.00' }, { Name: 'Domain name (1 year)', Price: '$10.00' }], Total: '$385.00' }) },
  { name: 'inambe-table', repo: 'Inambe_html-invoice-template', file: 'Inambe_html-invoice-template/invoice.html', style: 'bordered tables, flex' },
  { name: 'payrollflow-freelance', repo: 'PayrollFlow_freelance-invoice-templates', file: 'PayrollFlow_freelance-invoice-templates/templates/invoice-template.html', style: 'flex, tables' },
  { name: 'appsnipp-receipt', repo: 'appsnipp_html-receipt', file: 'appsnipp_html-receipt/bill.html', style: 'receipt, narrow column' },
  { name: 'cas8180-cash-receipt', repo: 'cas8180_cash-receipt-template', file: 'cas8180_cash-receipt-template/receipt.html', style: 'receipt, flex' },
  { name: 'lurepot-grid', repo: 'LurePot_bootstrap-_invoice_html', file: 'LurePot_bootstrap-_invoice_html/invoice2css.html', style: 'CSS grid + flex, bootstrap-like utility classes inlined' },
  { name: 'paperplane-grid', repo: 'paperplaneapp_html-invoice', file: 'paperplaneapp_html-invoice/invoice.html', style: 'CSS grid, tables' },
  { name: 'tociva-skyline', repo: 'tociva_free-invoice-generator', file: tociva + 'modern/skyline-invoice-template.html', style: 'flex header band, striped table', fill: 4 },
  { name: 'tociva-skyline-long', repo: 'tociva_free-invoice-generator', file: tociva + 'modern/skyline-invoice-template.html', style: 'multi-page: 60 line items', fill: 60 },
  { name: 'tociva-neon-blue', repo: 'tociva_free-invoice-generator', file: tociva + 'freelancer/neon-blue.html', style: 'flex, gradient', fill: 5 },
  { name: 'tociva-corporate-sidebar', repo: 'tociva_free-invoice-generator', file: tociva + 'simple-design/corporate-sidebar.html', style: 'flex sidebar', fill: 5 },
  { name: 'tociva-navy-ledger', repo: 'tociva_free-invoice-generator', file: tociva + 'corporate/navy-ledger-invoice-template.html', style: 'flex, two tables', fill: 6 },
  { name: 'tociva-vintage-gazette', repo: 'tociva_free-invoice-generator', file: tociva + 'simple-design/vintage-gazette.html', style: 'flex, serif, transforms', fill: 5 },
  { name: 'tociva-minimalist', repo: 'tociva_free-invoice-generator', file: tociva + 'freelancer/minimalist.html', style: 'flex, gradient, transforms', fill: 5 },
  { name: 'tociva-split-gradient', repo: 'tociva_free-invoice-generator', file: tociva + 'simple-design/split-gradient.html', style: 'grid, absolute positioning, pseudo-elements, gradients', fill: 5 },
];
for (const s of specs) {
  let html = read(s.file);
  html = s.custom ? s.custom(html) : s.fill ? fillBrackets(html, s.fill) : html;
  html = swapImages(stripRemoteLinks(html));
  const note = `<!-- Source: ${s.file.replace(/^[^/]+\//, '')} from github.com/${s.repo.replace('_', '/')}. ${licenceLine(s.repo)}. MIT licence, see SOURCES.md. Sample data filled in; remote fonts removed; images point at a local placeholder. -->\n`;
  fs.writeFileSync(path.join(OUT, `${s.name}.html`), note + html);
  console.log(s.name, html.length);
}
