// UN/CEFACT Cross Industry Invoice (CII D16B) writer for Factur-X / ZUGFeRD.
// Element order follows the Factur-X 1.07 / ZUGFeRD 2.3 schemas, which are
// order sensitive. Each profile only receives the elements its schema allows.

import { GUIDELINE_IDS, XRECHNUNG_BUSINESS_PROCESS, normalizeProfile, profileRank } from './model.mjs';
import { computeTotals, decimalString } from './totals.mjs';
import { assertValidInvoice } from './validate.mjs';

const NS = {
  rsm: 'urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100',
  qdt: 'urn:un:unece:uncefact:data:standard:QualifiedDataType:100',
  ram: 'urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100',
  udt: 'urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100',
};

/** Escape text for XML element content and attribute values; drops characters XML 1.0 forbids. */
export function escapeXml(value) {
  return String(value)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Format a date as CII format 102 (YYYYMMDD). */
export function formatDate102(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new Error('Invalid Date');
    return `${value.getUTCFullYear()}${String(value.getUTCMonth() + 1).padStart(2, '0')}${String(value.getUTCDate()).padStart(2, '0')}`;
  }
  const m = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(String(value).trim());
  if (!m) throw new Error(`Invalid date "${value}", use YYYY-MM-DD`);
  return m[1] + m[2] + m[3];
}

// Tiny element tree: el(name, attrs?, ...children). null/undefined/false children are skipped.
function el(name, attrs, ...children) {
  if (attrs === null || typeof attrs !== 'object' || Array.isArray(attrs) || attrs.__el) {
    children.unshift(attrs);
    attrs = {};
  }
  const kids = children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false && c !== '');
  return { __el: true, name, attrs, kids };
}
// Only emit an element whose text value is present.
const tx = (name, value, attrs) => (value === undefined || value === null || String(value).trim() === '' ? null : el(name, attrs || {}, String(value)));
// Only emit a wrapper when it has children.
const wrap = (name, ...children) => {
  const e = el(name, {}, ...children);
  return e.kids.length ? e : null;
};

function render(node, depth = 0) {
  const pad = '  '.repeat(depth);
  const attrs = Object.entries(node.attrs)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => ` ${k}="${escapeXml(v)}"`)
    .join('');
  if (node.kids.length === 0) return `${pad}<${node.name}${attrs}/>`;
  if (node.kids.length === 1 && !node.kids[0].__el) return `${pad}<${node.name}${attrs}>${escapeXml(node.kids[0])}</${node.name}>`;
  const inner = node.kids.map((k) => (k.__el ? render(k, depth + 1) : `${pad}  ${escapeXml(k)}`)).join('\n');
  return `${pad}<${node.name}${attrs}>\n${inner}\n${pad}</${node.name}>`;
}

const asList = (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);
const dateEl = (name, value, ns = 'udt') => (value ? el(name, el(`${ns}:DateTimeString`, { format: '102' }, formatDate102(value))) : null);
const schemeOf = (v, fallbackScheme) => (v && typeof v === 'object' ? { id: v.id, scheme: v.scheme } : { id: v, scheme: fallbackScheme });

function party(tag, p, { rank, role }) {
  if (!p) return null;
  const legal = p.legalId !== undefined ? schemeOf(p.legalId) : null;
  const eaddr = p.electronicAddress !== undefined ? schemeOf(p.electronicAddress, 'EM') : null;
  const a = p.address || {};
  if (rank === 0) {
    // MINIMUM: seller has name, legal id, country, tax registrations; buyer has name and legal id.
    return el(tag,
      tx('ram:Name', p.name),
      legal?.id ? el('ram:SpecifiedLegalOrganization', tx('ram:ID', legal.id, { schemeID: legal.scheme })) : null,
      role === 'seller' ? el('ram:PostalTradeAddress', tx('ram:CountryID', a.country)) : null,
      role === 'seller' ? taxRegs(p) : null,
    );
  }
  const c = p.contact || {};
  return el(tag,
    tx('ram:ID', p.id),
    p.globalId?.id ? tx('ram:GlobalID', p.globalId.id, { schemeID: p.globalId.scheme }) : null,
    tx('ram:Name', p.name),
    rank >= 3 && role === 'seller' ? tx('ram:Description', p.description) : null,
    legal?.id || p.tradingName
      ? el('ram:SpecifiedLegalOrganization', legal?.id ? tx('ram:ID', legal.id, { schemeID: legal.scheme }) : null, tx('ram:TradingBusinessName', p.tradingName))
      : null,
    rank >= 3 && (c.name || c.department || c.phone || c.email)
      ? el('ram:DefinedTradeContact',
          tx('ram:PersonName', c.name),
          tx('ram:DepartmentName', c.department),
          c.phone ? el('ram:TelephoneUniversalCommunication', tx('ram:CompleteNumber', c.phone)) : null,
          c.email ? el('ram:EmailURIUniversalCommunication', tx('ram:URIID', c.email)) : null)
      : null,
    address(a),
    eaddr?.id ? el('ram:URIUniversalCommunication', tx('ram:URIID', eaddr.id, { schemeID: eaddr.scheme || 'EM' })) : null,
    taxRegs(p),
  );
}

function address(a) {
  if (!a) return null;
  return wrap('ram:PostalTradeAddress',
    tx('ram:PostcodeCode', a.postcode),
    tx('ram:LineOne', a.line1),
    tx('ram:LineTwo', a.line2),
    tx('ram:LineThree', a.line3),
    tx('ram:CityName', a.city),
    tx('ram:CountryID', a.country),
    tx('ram:CountrySubDivisionName', a.subdivision));
}

function taxRegs(p) {
  return [
    p.vatId ? el('ram:SpecifiedTaxRegistration', tx('ram:ID', p.vatId, { schemeID: 'VA' })) : null,
    p.taxNumber ? el('ram:SpecifiedTaxRegistration', tx('ram:ID', p.taxNumber, { schemeID: 'FC' })) : null,
  ];
}

const indicator = (charge) => el('ram:ChargeIndicator', el('udt:Indicator', charge ? 'true' : 'false'));

function allowanceCharge(ac, computed, charge, { currencyless = true, docLevel = false } = {}) {
  return el('ram:SpecifiedTradeAllowanceCharge',
    indicator(charge),
    ac.percent !== undefined && ac.percent !== null ? tx('ram:CalculationPercent', decimalString(ac.percent)) : null,
    computed.baseAmount !== undefined ? tx('ram:BasisAmount', computed.baseAmount) : null,
    tx('ram:ActualAmount', computed.amount),
    tx('ram:ReasonCode', ac.reasonCode),
    tx('ram:Reason', ac.reason),
    docLevel
      ? el('ram:CategoryTradeTax',
          tx('ram:TypeCode', 'VAT'),
          tx('ram:CategoryCode', ac.vatCategory),
          ac.vatCategory === 'O' ? null : tx('ram:RateApplicablePercent', decimalString(ac.vatRate ?? 0)))
      : null,
  );
}

function lineItem(line, t, rank) {
  const en = rank >= 3;
  return el('ram:IncludedSupplyChainTradeLineItem',
    el('ram:AssociatedDocumentLineDocument',
      tx('ram:LineID', line.id),
      line.note ? el('ram:IncludedNote', tx('ram:Content', line.note)) : null),
    el('ram:SpecifiedTradeProduct',
      line.standardId?.id ? tx('ram:GlobalID', line.standardId.id, { schemeID: line.standardId.scheme }) : null,
      en ? tx('ram:SellerAssignedID', line.sellerItemId) : null,
      en ? tx('ram:BuyerAssignedID', line.buyerItemId) : null,
      tx('ram:Name', line.name),
      en ? tx('ram:Description', line.description) : null),
    el('ram:SpecifiedLineTradeAgreement',
      en && line.orderLineReference ? el('ram:BuyerOrderReferencedDocument', tx('ram:LineID', line.orderLineReference)) : null,
      line.grossPrice !== undefined
        ? el('ram:GrossPriceProductTradePrice',
            tx('ram:ChargeAmount', decimalString(line.grossPrice)),
            line.basisQuantity !== undefined ? tx('ram:BasisQuantity', decimalString(line.basisQuantity), { unitCode: line.unitCode }) : null)
        : null,
      el('ram:NetPriceProductTradePrice',
        tx('ram:ChargeAmount', decimalString(line.netPrice)),
        line.basisQuantity !== undefined ? tx('ram:BasisQuantity', decimalString(line.basisQuantity), { unitCode: line.unitCode }) : null)),
    el('ram:SpecifiedLineTradeDelivery',
      tx('ram:BilledQuantity', decimalString(line.quantity), { unitCode: line.unitCode })),
    el('ram:SpecifiedLineTradeSettlement',
      el('ram:ApplicableTradeTax',
        tx('ram:TypeCode', 'VAT'),
        tx('ram:CategoryCode', line.vatCategory),
        line.vatCategory === 'O' ? null : tx('ram:RateApplicablePercent', decimalString(line.vatRate ?? 0))),
      line.period ? el('ram:BillingSpecifiedPeriod', dateEl('ram:StartDateTime', line.period.start), dateEl('ram:EndDateTime', line.period.end)) : null,
      asList(line.allowances).map((a, i) => allowanceCharge(a, t.allowances[i], false)),
      asList(line.charges).map((c, i) => allowanceCharge(c, t.charges[i], true)),
      el('ram:SpecifiedTradeSettlementLineMonetarySummation', tx('ram:LineTotalAmount', t.netAmount))),
  );
}

function paymentMeans(pm, rank) {
  const en = rank >= 3;
  return el('ram:SpecifiedTradeSettlementPaymentMeans',
    tx('ram:TypeCode', pm.code),
    en ? tx('ram:Information', pm.information) : null,
    en && pm.card?.number ? el('ram:ApplicableTradeSettlementFinancialCard', tx('ram:ID', pm.card.number), tx('ram:CardholderName', pm.card.holder)) : null,
    pm.debtorIban ? el('ram:PayerPartyDebtorFinancialAccount', tx('ram:IBANID', pm.debtorIban.replace(/\s/g, ''))) : null,
    pm.iban || pm.accountId
      ? el('ram:PayeePartyCreditorFinancialAccount',
          pm.iban ? tx('ram:IBANID', pm.iban.replace(/\s/g, '')) : null,
          en ? tx('ram:AccountName', pm.accountName) : null,
          !pm.iban ? tx('ram:ProprietaryID', pm.accountId) : null)
      : null,
    en && pm.bic ? el('ram:PayeeSpecifiedCreditorFinancialInstitution', tx('ram:BICID', pm.bic)) : null,
  );
}

/**
 * Build the CII XML (factur-x.xml) for an invoice.
 *
 * @param {import('./model.mjs').Invoice} invoice
 * @param {{ profile?: string, validate?: boolean }} [options]
 *   profile: MINIMUM, BASICWL, BASIC, EN16931 (default) or XRECHNUNG.
 *   validate: run validateInvoice first and throw a readable error (default true).
 * @returns {string} UTF-8 XML text
 */
export function buildCiiXml(invoice, options = {}) {
  const profile = normalizeProfile(options.profile || 'EN16931');
  const rank = profileRank(profile);
  if (options.validate !== false) assertValidInvoice(invoice, profile);
  const t = computeTotals(invoice);
  const cur = invoice.currency;
  const xr = profile === 'XRECHNUNG';
  const businessProcess = invoice.businessProcess || (xr ? XRECHNUNG_BUSINESS_PROCESS : undefined);
  const hasK = t.vatBreakdown.some((g) => g.category === 'K');
  const shipTo = invoice.delivery?.address || (hasK ? invoice.buyer?.address : undefined);
  const terms = invoice.paymentTerms || {};

  const root = el('rsm:CrossIndustryInvoice', { 'xmlns:rsm': NS.rsm, 'xmlns:qdt': NS.qdt, 'xmlns:ram': NS.ram, 'xmlns:udt': NS.udt },
    el('rsm:ExchangedDocumentContext',
      businessProcess ? el('ram:BusinessProcessSpecifiedDocumentContextParameter', tx('ram:ID', businessProcess)) : null,
      el('ram:GuidelineSpecifiedDocumentContextParameter', tx('ram:ID', GUIDELINE_IDS[profile]))),
    el('rsm:ExchangedDocument',
      tx('ram:ID', invoice.number),
      tx('ram:TypeCode', invoice.typeCode || '380'),
      dateEl('ram:IssueDateTime', invoice.issueDate),
      rank >= 1
        ? asList(invoice.notes).map((n) => (typeof n === 'string'
          ? el('ram:IncludedNote', tx('ram:Content', n))
          : el('ram:IncludedNote', tx('ram:Content', n.content), tx('ram:SubjectCode', n.subjectCode))))
        : null),
    el('rsm:SupplyChainTradeTransaction',
      rank >= 2 ? invoice.lines.map((line, i) => lineItem(line, t.lines[i], rank)) : null,
      el('ram:ApplicableHeaderTradeAgreement',
        tx('ram:BuyerReference', invoice.buyerReference),
        party('ram:SellerTradeParty', invoice.seller, { rank, role: 'seller' }),
        party('ram:BuyerTradeParty', invoice.buyer, { rank, role: 'buyer' }),
        invoice.orderReference ? el('ram:BuyerOrderReferencedDocument', tx('ram:IssuerAssignedID', invoice.orderReference)) : null,
        rank >= 1 && invoice.contractReference ? el('ram:ContractReferencedDocument', tx('ram:IssuerAssignedID', invoice.contractReference)) : null),
      el('ram:ApplicableHeaderTradeDelivery',
        rank >= 1 && shipTo
          ? el('ram:ShipToTradeParty', tx('ram:Name', invoice.delivery?.name), address(shipTo))
          : null,
        rank >= 1 && invoice.delivery?.date
          ? el('ram:ActualDeliverySupplyChainEvent', dateEl('ram:OccurrenceDateTime', invoice.delivery.date))
          : null),
      el('ram:ApplicableHeaderTradeSettlement',
        rank >= 1 ? tx('ram:CreditorReferenceID', invoice.creditorReferenceId) : null,
        rank >= 1 ? tx('ram:PaymentReference', invoice.paymentReference) : null,
        rank >= 1 && invoice.taxCurrency && invoice.taxCurrency !== cur ? tx('ram:TaxCurrencyCode', invoice.taxCurrency) : null,
        tx('ram:InvoiceCurrencyCode', cur),
        rank >= 1 ? asList(invoice.paymentMeans).map((pm) => paymentMeans(pm, rank)) : null,
        rank >= 1
          ? t.vatBreakdown.map((g) => el('ram:ApplicableTradeTax',
              tx('ram:CalculatedAmount', g.tax),
              tx('ram:TypeCode', 'VAT'),
              tx('ram:ExemptionReason', g.exemptionReason),
              tx('ram:BasisAmount', g.basis),
              tx('ram:CategoryCode', g.category),
              tx('ram:ExemptionReasonCode', g.exemptionReasonCode),
              g.category === 'O' ? null : tx('ram:RateApplicablePercent', g.rate)))
          : null,
        rank >= 1 && invoice.delivery?.period
          ? el('ram:BillingSpecifiedPeriod', dateEl('ram:StartDateTime', invoice.delivery.period.start), dateEl('ram:EndDateTime', invoice.delivery.period.end))
          : null,
        rank >= 1 ? asList(invoice.allowances).map((a, i) => allowanceCharge(a, t.allowances[i], false, { docLevel: true })) : null,
        rank >= 1 ? asList(invoice.charges).map((c, i) => allowanceCharge(c, t.charges[i], true, { docLevel: true })) : null,
        rank >= 1 && (terms.description || terms.dueDate || terms.directDebitMandateId)
          ? el('ram:SpecifiedTradePaymentTerms',
              tx('ram:Description', terms.description),
              dateEl('ram:DueDateDateTime', terms.dueDate),
              tx('ram:DirectDebitMandateID', terms.directDebitMandateId))
          : null,
        el('ram:SpecifiedTradeSettlementHeaderMonetarySummation',
          rank >= 1 ? tx('ram:LineTotalAmount', t.lineTotal) : null,
          rank >= 1 && asList(invoice.charges).length ? tx('ram:ChargeTotalAmount', t.chargeTotal) : null,
          rank >= 1 && asList(invoice.allowances).length ? tx('ram:AllowanceTotalAmount', t.allowanceTotal) : null,
          tx('ram:TaxBasisTotalAmount', t.taxBasisTotal),
          tx('ram:TaxTotalAmount', t.taxTotal, { currencyID: cur }),
          tx('ram:GrandTotalAmount', t.grandTotal),
          rank >= 1 && t.prepaid !== '0.00' ? tx('ram:TotalPrepaidAmount', t.prepaid) : null,
          tx('ram:DuePayableAmount', t.duePayable)),
        rank >= 1 && invoice.precedingInvoice?.number
          ? el('ram:InvoiceReferencedDocument',
              tx('ram:IssuerAssignedID', invoice.precedingInvoice.number),
              dateEl('ram:FormattedIssueDateTime', invoice.precedingInvoice.date, 'qdt'))
          : null)),
  );

  return `<?xml version="1.0" encoding="UTF-8"?>\n${render(root)}\n`;
}
