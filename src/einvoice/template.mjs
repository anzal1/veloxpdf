// Default visible invoice for renderEInvoice: A4, print-friendly, plain CSS.
// It reads only the invoice model and the totals from computeTotals, the same numbers that go
// into the CII XML, so the printed page and the embedded XML always agree.

const UNIT_LABELS = {
  C62: 'pcs', H87: 'pcs', EA: 'each', HUR: 'h', DAY: 'd', WEE: 'wk', MON: 'mo', ANN: 'yr',
  MIN: 'min', KGM: 'kg', GRM: 'g', MTR: 'm', KMT: 'km', LTR: 'l', MTK: 'm²', MTQ: 'm³', SET: 'set', LS: 'lump sum',
};

const VAT_LABELS = {
  S: 'Standard rate', Z: 'Zero rated', E: 'Exempt', AE: 'Reverse charge', K: 'Intra-EU supply',
  G: 'Export outside the EU', O: 'Not subject to VAT', L: 'Canary Islands IGIC', M: 'Ceuta and Melilla IPSI',
};

const DOC_TITLES = {
  380: 'Invoice', 381: 'Credit note', 384: 'Corrected invoice', 389: 'Self-billed invoice',
  326: 'Partial invoice', 386: 'Prepayment invoice', 751: 'Invoice information',
};

const PAYMENT_LABELS = {
  10: 'Cash', 30: 'Credit transfer', 42: 'Bank account', 48: 'Card', 49: 'Direct debit', 54: 'Credit card',
  55: 'Debit card', 57: 'Standing agreement', 58: 'SEPA credit transfer', 59: 'SEPA direct debit',
};

// HTML escape that also neutralises template braces, so invoice text is never interpolated.
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;');
}

function groupThousands(intPart) {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** "1234.5" -> "1,234.50" (keeps extra decimals of unit prices, at least 2). */
export function formatAmount(value, minPlaces = 2) {
  let s = String(value ?? '0').trim();
  if (typeof value === 'number') s = String(value);
  const neg = s.startsWith('-');
  if (neg) s = s.slice(1);
  let [i, f = ''] = s.split('.');
  f = f.replace(/0+$/, '');
  if (f.length < minPlaces) f = f.padEnd(minPlaces, '0');
  return `${neg ? '-' : ''}${groupThousands(i || '0')}.${f}`;
}

function formatQty(value) {
  const s = String(value ?? '');
  if (!s.includes('.')) return groupThousands(s);
  const [i, f] = s.split('.');
  const t = f.replace(/0+$/, '');
  return t ? `${groupThousands(i)}.${t}` : groupThousands(i);
}

/** "2026-10-20" / "20261020" / Date -> "20 Oct 2026". */
export function formatDate(value) {
  if (!value) return '';
  let y, m, d;
  if (value instanceof Date) {
    y = value.getUTCFullYear(); m = value.getUTCMonth() + 1; d = value.getUTCDate();
  } else {
    const digits = String(value).replace(/-/g, '');
    y = Number(digits.slice(0, 4)); m = Number(digits.slice(4, 6)); d = Number(digits.slice(6, 8));
  }
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${months[m - 1] || ''} ${y}`;
}

const asList = (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);

function idText(v) {
  if (!v) return '';
  return typeof v === 'string' ? v : v.id;
}

function partyBlock(label, p = {}) {
  const a = p.address || {};
  const lines = [
    a.line1, a.line2, a.line3,
    [a.postcode, a.city].filter(Boolean).join(' '),
    [a.subdivision, a.country].filter(Boolean).join(', '),
  ].filter(Boolean);
  const ids = [
    p.vatId ? `VAT ID ${p.vatId}` : '',
    p.taxNumber ? `Tax no. ${p.taxNumber}` : '',
    p.legalId ? `Reg. ${idText(p.legalId)}` : '',
  ].filter(Boolean);
  const c = p.contact || {};
  const contact = [c.name, c.phone, c.email].filter(Boolean);
  return `<div class="party">
    <div class="label">${esc(label)}</div>
    <div class="party-name">${esc(p.name)}</div>
    ${lines.map((l) => `<div class="muted">${esc(l)}</div>`).join('')}
    ${ids.length ? `<div class="small">${ids.map(esc).join(' · ')}</div>` : ''}
    ${contact.length ? `<div class="small">${contact.map(esc).join(' · ')}</div>` : ''}
  </div>`;
}

/**
 * Data handed to a custom `template` (Handlebars-style placeholders are filled from it):
 * { invoice, totals, profile, conformanceLevel, view } where `view` holds display-ready strings
 * (title, dates, lines[], vat[], totals, payment[], notes[]).
 */
export function buildInvoiceView(invoice, totals, { profile, conformanceLevel } = {}) {
  const cur = invoice.currency;
  const lines = (invoice.lines || []).map((line, i) => {
    const t = totals.lines[i] || {};
    const adj = [
      ...asList(line.allowances).map((a, k) => `${a.reason || 'Allowance'}${a.percent !== undefined ? ` ${formatQty(a.percent)}%` : ''}: -${formatAmount(t.allowances?.[k]?.amount)}`),
      ...asList(line.charges).map((c, k) => `${c.reason || 'Charge'}${c.percent !== undefined ? ` ${formatQty(c.percent)}%` : ''}: +${formatAmount(t.charges?.[k]?.amount)}`),
    ];
    return {
      id: line.id,
      name: line.name,
      description: line.description || '',
      adjustments: adj,
      quantity: formatQty(line.quantity),
      unit: UNIT_LABELS[line.unitCode] || line.unitCode,
      price: formatAmount(line.netPrice),
      basis: line.basisQuantity !== undefined && String(line.basisQuantity) !== '1' ? `per ${formatQty(line.basisQuantity)}` : '',
      vat: line.vatCategory === 'O' ? 'O' : `${formatQty(line.vatRate ?? 0)}%`,
      net: formatAmount(t.netAmount),
    };
  });
  const docAdjustments = [
    ...asList(invoice.allowances).map((a, k) => ({
      label: `${a.reason || 'Allowance'}${a.percent !== undefined ? ` (${formatQty(a.percent)}%)` : ''}`,
      vat: a.vatCategory === 'O' ? 'O' : `${formatQty(a.vatRate ?? 0)}%`,
      amount: `-${formatAmount(totals.allowances[k]?.amount)}`,
    })),
    ...asList(invoice.charges).map((c, k) => ({
      label: `${c.reason || 'Charge'}${c.percent !== undefined ? ` (${formatQty(c.percent)}%)` : ''}`,
      vat: c.vatCategory === 'O' ? 'O' : `${formatQty(c.vatRate ?? 0)}%`,
      amount: `+${formatAmount(totals.charges[k]?.amount)}`,
    })),
  ];
  const vat = totals.vatBreakdown.map((g) => ({
    label: `${VAT_LABELS[g.category] || g.category}${g.rate !== undefined ? ` ${formatQty(g.rate)}%` : ''}`,
    basis: formatAmount(g.basis),
    tax: formatAmount(g.tax),
    note: [g.exemptionReason, g.exemptionReasonCode].filter(Boolean).join(' · '),
  }));
  const payment = asList(invoice.paymentMeans).map((pm) => ({
    method: PAYMENT_LABELS[pm.code] || `Payment means ${pm.code}`,
    rows: [
      pm.accountName ? ['Account holder', pm.accountName] : null,
      pm.iban ? ['IBAN', pm.iban] : null,
      pm.bic ? ['BIC', pm.bic] : null,
      pm.debtorIban ? ['Debited account', pm.debtorIban] : null,
      pm.card?.number ? ['Card', `**** ${pm.card.number}`] : null,
      pm.information ? ['Note', pm.information] : null,
    ].filter(Boolean),
  }));
  const docTitle = DOC_TITLES[invoice.typeCode || '380'] || 'Invoice';
  const meta = [
    [`${docTitle} no.`, invoice.number],
    ['Issue date', formatDate(invoice.issueDate)],
    invoice.delivery?.date ? ['Delivery date', formatDate(invoice.delivery.date)] : null,
    invoice.delivery?.period ? ['Service period', `${formatDate(invoice.delivery.period.start)} to ${formatDate(invoice.delivery.period.end)}`] : null,
    invoice.paymentTerms?.dueDate ? ['Due date', formatDate(invoice.paymentTerms.dueDate)] : null,
    invoice.buyerReference ? ['Buyer reference', invoice.buyerReference] : null,
    invoice.orderReference && invoice.orderReference !== invoice.buyerReference ? ['Order', invoice.orderReference] : null,
    invoice.contractReference ? ['Contract', invoice.contractReference] : null,
    invoice.precedingInvoice?.number ? ['Corrects invoice', `${invoice.precedingInvoice.number}${invoice.precedingInvoice.date ? ` of ${formatDate(invoice.precedingInvoice.date)}` : ''}`] : null,
  ].filter(Boolean);
  const summary = [
    ['Sum of lines', formatAmount(totals.lineTotal)],
    asList(invoice.allowances).length ? ['Allowances', `-${formatAmount(totals.allowanceTotal)}`] : null,
    asList(invoice.charges).length ? ['Charges', `+${formatAmount(totals.chargeTotal)}`] : null,
    ['Net total', formatAmount(totals.taxBasisTotal)],
    ['VAT', formatAmount(totals.taxTotal)],
    ['Total', formatAmount(totals.grandTotal)],
    totals.prepaid !== '0.00' ? ['Paid in advance', `-${formatAmount(totals.prepaid)}`] : null,
  ].filter(Boolean);
  return {
    title: DOC_TITLES[invoice.typeCode || '380'] || 'Invoice',
    currency: cur,
    meta,
    lines,
    docAdjustments,
    vat,
    summary,
    due: formatAmount(totals.duePayable),
    dueLabel: (invoice.typeCode || '380') === '381' ? 'Amount credited' : 'Amount due',
    payment,
    paymentTerms: invoice.paymentTerms?.description || '',
    paymentReference: invoice.paymentReference || '',
    notes: asList(invoice.notes).map((n) => (typeof n === 'string' ? n : n.content)),
    badge: `Factur-X / ZUGFeRD ${conformanceLevel || profile || ''} · PDF/A-3b · structured data embedded`,
  };
}

const CSS = `
  @page { size: A4; margin: 16mm 16mm 18mm 16mm; }
  body { font-family: Helvetica, Arial, sans-serif; font-size: 9.5px; color: #1f2933; line-height: 1.4; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 22px; }
  .seller-name { font-size: 15px; font-weight: bold; color: #102a43; }
  .doc-title { font-size: 22px; font-weight: bold; color: #102a43; text-align: right; }
  .doc-number { font-size: 10px; color: #52606d; text-align: right; }
  .parties { display: flex; justify-content: space-between; margin-bottom: 18px; }
  .party { width: 48%; }
  .label { font-size: 7.5px; font-weight: bold; color: #829ab1; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 3px; }
  .party-name { font-size: 11px; font-weight: bold; color: #102a43; margin-bottom: 1px; }
  .muted { color: #52606d; }
  .small { font-size: 8px; color: #52606d; margin-top: 2px; }
  .meta { width: 100%; border-collapse: collapse; margin-bottom: 18px; background: #f5f7fa; }
  .meta td { padding: 6px 8px; vertical-align: top; }
  .meta .k { font-size: 7.5px; color: #829ab1; text-transform: uppercase; }
  .meta .v { font-size: 9.5px; font-weight: bold; color: #102a43; }
  table.lines { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  table.lines th { font-size: 7.5px; text-transform: uppercase; color: #ffffff; background: #243b53; padding: 6px 6px; text-align: left; }
  table.lines td { padding: 6px 6px; border-bottom: 1px solid #e4e7eb; vertical-align: top; }
  .num { text-align: right; }
  .item { font-weight: bold; color: #102a43; }
  .desc { font-size: 8px; color: #52606d; }
  .after { display: flex; justify-content: space-between; align-items: flex-start; margin-top: 8px; }
  .left { width: 52%; }
  .right { width: 42%; }
  .vat { margin-bottom: 12px; }
  .row { display: flex; padding: 4px 0; border-bottom: 1px solid #e4e7eb; }
  .row.head { font-size: 7.5px; font-weight: bold; text-transform: uppercase; color: #829ab1; border-bottom: 1px solid #bcccdc; }
  .c1 { width: 50%; }
  .c2 { width: 25%; text-align: right; }
  .c3 { width: 25%; text-align: right; }
  .srow { display: flex; justify-content: space-between; padding: 4px 2px; }
  .srow.total { font-weight: bold; color: #102a43; border-top: 1px solid #bcccdc; }
  .sk { color: #52606d; }
  .sv { text-align: right; }
  .due { background: #102a43; color: #ffffff; padding: 9px 10px; margin-top: 6px; display: flex; justify-content: space-between; align-items: center; }
  .due-label { font-size: 9px; font-weight: bold; color: #ffffff; }
  .due-amount { font-size: 13px; font-weight: bold; color: #ffffff; }
  .box { border: 1px solid #d9e2ec; padding: 8px 10px; margin-bottom: 10px; }
  .box-title { font-size: 7.5px; font-weight: bold; color: #829ab1; text-transform: uppercase; margin-bottom: 4px; }
  .pay-row { display: flex; }
  .pay-k { width: 90px; color: #829ab1; }
  .pay-v { font-weight: bold; color: #102a43; }
  .notes { margin-top: 14px; font-size: 8.5px; color: #52606d; }
  .badge { margin-top: 18px; font-size: 7px; color: #9aa5b1; }
`;

/** Default invoice HTML. */
export function buildInvoiceHtml(invoice, totals, opts = {}) {
  const v = buildInvoiceView(invoice, totals, opts);
  const cur = esc(v.currency);
  const metaCells = v.meta.map(([k, val]) => `<td><div class="k">${esc(k)}</div><div class="v">${esc(val)}</div></td>`);
  const metaRows = [];
  for (let i = 0; i < metaCells.length; i += 4) metaRows.push(`<tr>${metaCells.slice(i, i + 4).join('')}</tr>`);

  const lineRows = v.lines.map((l) => `<tr>
      <td>${esc(l.id)}</td>
      <td><div class="item">${esc(l.name)}</div>${l.description ? `<div class="desc">${esc(l.description)}</div>` : ''}${l.adjustments.map((a) => `<div class="desc">${esc(a)}</div>`).join('')}</td>
      <td class="num">${esc(l.quantity)} ${esc(l.unit)}</td>
      <td class="num">${esc(l.price)}${l.basis ? `<div class="desc">${esc(l.basis)}</div>` : ''}</td>
      <td class="num">${esc(l.vat)}</td>
      <td class="num">${esc(l.net)}</td>
    </tr>`).join('');
  const adjRows = v.docAdjustments.map((a) => `<tr>
      <td></td><td><div class="item">${esc(a.label)}</div></td><td></td><td></td>
      <td class="num">${esc(a.vat)}</td><td class="num">${esc(a.amount)}</td></tr>`).join('');

  const vatRows = v.vat.map((g) => `<div class="row"><div class="c1">${esc(g.label)}${g.note ? `<div class="desc">${esc(g.note)}</div>` : ''}</div><div class="c2">${esc(g.basis)}</div><div class="c3">${esc(g.tax)}</div></div>`).join('');
  const sumRows = v.summary.map(([k, val]) => `<div class="srow${k === 'Total' ? ' total' : ''}"><div class="sk">${esc(k)}</div><div class="sv">${esc(val)} ${cur}</div></div>`).join('');

  const payment = v.payment.length || v.paymentTerms || v.paymentReference
    ? `<div class="box"><div class="box-title">Payment</div>
        ${v.paymentTerms ? `<div style="margin-bottom: 4px">${esc(v.paymentTerms)}</div>` : ''}
        ${v.payment.map((p) => `<div class="pay-row"><div class="pay-k">Method</div><div class="pay-v">${esc(p.method)}</div></div>
          ${p.rows.map(([k, val]) => `<div class="pay-row"><div class="pay-k">${esc(k)}</div><div class="pay-v">${esc(val)}</div></div>`).join('')}`).join('')}
        ${v.paymentReference ? `<div class="pay-row"><div class="pay-k">Reference</div><div class="pay-v">${esc(v.paymentReference)}</div></div>` : ''}
      </div>`
    : '';

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(v.title)} ${esc(invoice.number)}</title><style>${CSS}</style></head><body>
  <div class="top">
    <div><div class="seller-name">${esc(invoice.seller?.name)}</div><div class="muted">${esc([invoice.seller?.address?.line1, [invoice.seller?.address?.postcode, invoice.seller?.address?.city].filter(Boolean).join(' '), invoice.seller?.address?.country].filter(Boolean).join(' · '))}</div></div>
    <div><div class="doc-title">${esc(v.title)}</div><div class="doc-number">${esc(invoice.number)}</div></div>
  </div>
  <div class="parties">${partyBlock('From', invoice.seller)}${partyBlock('Bill to', invoice.buyer)}</div>
  <table class="meta">${metaRows.join('')}</table>
  <table class="lines">
    <thead><tr><th style="width: 22px">#</th><th>Description</th><th style="width: 70px; text-align: right">Qty</th><th style="width: 70px; text-align: right">Unit price</th><th style="width: 40px; text-align: right">VAT</th><th style="width: 75px; text-align: right">Net (${cur})</th></tr></thead>
    <tbody>${lineRows}${adjRows}</tbody>
  </table>
  <div class="after">
    <div class="left">
      <div class="vat"><div class="row head"><div class="c1">VAT breakdown</div><div class="c2">Net (${cur})</div><div class="c3">VAT (${cur})</div></div>${vatRows}</div>
      ${payment}
    </div>
    <div class="right">
      <div class="sum">${sumRows}</div>
      <div class="due"><div class="due-label">${esc(v.dueLabel)}</div><div class="due-amount">${esc(v.due)} ${cur}</div></div>
    </div>
  </div>
  ${v.notes.length ? `<div class="notes">${v.notes.map((n) => `<div>${esc(n)}</div>`).join('')}</div>` : ''}
  <div class="badge">${esc(v.badge)}</div>
</body></html>`;
}
