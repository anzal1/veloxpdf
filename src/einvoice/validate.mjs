// Readable pre-flight checks for the mandatory EN 16931 business terms,
// so a missing field gives one clear sentence instead of a schematron dump.

import { normalizeProfile, profileRank, VAT_CATEGORIES, DOCUMENT_TYPE_CODES, EXEMPT_CATEGORIES } from './model.mjs';
import { dec, computeTotals } from './totals.mjs';

const blank = (v) => v === undefined || v === null || String(v).trim() === '';

function isDate(v) {
  if (v instanceof Date) return !Number.isNaN(v.getTime());
  return typeof v === 'string' && /^\d{4}-?\d{2}-?\d{2}$/.test(v.trim());
}

function isNumber(v) {
  if (blank(v)) return false;
  try { dec(v); return true; } catch { return false; }
}

const asList = (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);

/**
 * Check an invoice against the business rules that apply to a profile.
 * Returns an array of { term, message }; an empty array means it is ready.
 *
 * @param {import('./model.mjs').Invoice} invoice
 * @param {string} [profile='EN16931']
 */
export function validateInvoice(invoice, profile = 'EN16931') {
  const p = normalizeProfile(profile);
  const rank = profileRank(p);
  const xr = p === 'XRECHNUNG';
  const errors = [];
  const err = (term, message) => errors.push({ term, message: `${term} ${message}` });

  if (!invoice || typeof invoice !== 'object') return [{ term: 'BG-0', message: 'BG-0 The invoice must be an object' }];
  const seller = invoice.seller || {};
  const buyer = invoice.buyer || {};
  const lines = invoice.lines || [];

  if (blank(invoice.number)) err('BT-1', 'Invoice number is required');
  if (!isDate(invoice.issueDate)) err('BT-2', 'Invoice issue date is required (YYYY-MM-DD)');
  const typeCode = String(invoice.typeCode ?? '380');
  if (!DOCUMENT_TYPE_CODES.includes(typeCode)) err('BT-3', `Invoice type code "${typeCode}" is not supported (use 380 invoice or 381 credit note)`);
  if (!/^[A-Z]{3}$/.test(invoice.currency || '')) err('BT-5', 'Invoice currency code is required as an ISO 4217 code such as EUR');
  if (blank(seller.name)) err('BT-27', 'Seller name is required');
  if (blank(seller.address?.country)) err('BT-40', 'Seller country code is required (ISO 3166-1 alpha-2, for example DE)');
  else if (!/^[A-Z]{2}$/.test(seller.address.country)) err('BT-40', `Seller country code "${seller.address.country}" must be two upper case letters`);
  if (blank(buyer.name)) err('BT-44', 'Buyer name is required');
  if (rank >= 1 && blank(buyer.address?.country)) err('BT-55', 'Buyer country code is required');

  if (lines.length === 0) err('BG-25', 'At least one invoice line is required (totals are computed from the lines)');
  const categories = new Set();
  lines.forEach((line, i) => {
    const at = `on line ${i + 1}${line?.id ? ` (${line.id})` : ''}`;
    if (blank(line.id)) err('BT-126', `Invoice line identifier is required ${at}`);
    if (blank(line.name)) err('BT-153', `Item name is required ${at}`);
    if (!isNumber(line.quantity)) err('BT-129', `Invoiced quantity is required ${at}`);
    if (blank(line.unitCode)) err('BT-130', `Unit of measure code is required ${at} (for example C62, HUR, DAY)`);
    if (!isNumber(line.netPrice)) err('BT-146', `Item net price is required ${at}`);
    else if (dec(line.netPrice).n < 0n) err('BT-146', `Item net price must not be negative ${at}`);
    if (line.basisQuantity !== undefined && (!isNumber(line.basisQuantity) || dec(line.basisQuantity).n <= 0n)) err('BT-149', `Item price base quantity must be positive ${at}`);
    checkVat(line.vatCategory, line.vatRate, `${at}`, 'BT-151', 'BT-152');
    for (const a of asList(line.allowances)) checkAc(a, 'allowance', at, 'BT-139', 'BT-140', false);
    for (const c of asList(line.charges)) checkAc(c, 'charge', at, 'BT-144', 'BT-145', false);
  });
  asList(invoice.allowances).forEach((a, i) => checkAc(a, 'allowance', `on document allowance ${i + 1}`, 'BT-97', 'BT-98', true));
  asList(invoice.charges).forEach((c, i) => checkAc(c, 'charge', `on document charge ${i + 1}`, 'BT-104', 'BT-105', true));

  function checkVat(category, rate, at, catTerm, rateTerm) {
    if (blank(category)) { err(catTerm, `VAT category code is required ${at}`); return; }
    if (!VAT_CATEGORIES.includes(category)) { err(catTerm, `VAT category code "${category}" is not valid ${at} (use S, Z, E, AE, K, G or O)`); return; }
    categories.add(category);
    if (category === 'O') {
      if (!blank(rate)) err(rateTerm, `VAT rate must be left out for category O (not subject to VAT) ${at}`);
    } else if (!isNumber(rate)) err(rateTerm, `VAT rate is required for category ${category} ${at}`);
    else if (category === 'S' && dec(rate).n <= 0n) err(rateTerm, `VAT rate must be greater than zero for standard rated items ${at}`);
    else if (['Z', 'E', 'AE', 'K', 'G'].includes(category) && dec(rate).n !== 0n) err(rateTerm, `VAT rate must be 0 for category ${category} ${at}`);
  }

  function checkAc(ac, kind, at, reasonTerm, codeTerm, docLevel) {
    const amountTerm = kind === 'allowance' ? (docLevel ? 'BT-92' : 'BT-136') : (docLevel ? 'BT-99' : 'BT-141');
    if (!isNumber(ac?.amount) && !isNumber(ac?.percent)) err(amountTerm, `An ${kind} amount or percent is required ${at}`);
    if (blank(ac?.reason) && blank(ac?.reasonCode)) err(reasonTerm, `An ${kind} reason or reason code (${codeTerm}) is required ${at}`);
    if (docLevel) checkVat(ac?.vatCategory, ac?.vatRate, at, kind === 'allowance' ? 'BT-95' : 'BT-102', kind === 'allowance' ? 'BT-96' : 'BT-103');
  }

  // Seller and buyer identification by VAT category (BR-S-02, BR-AE-02, BR-IC-02, BR-G-02, BR-O-02 ...).
  const sellerTaxId = !blank(seller.vatId) || !blank(seller.taxNumber);
  if (rank >= 1) {
    for (const c of ['S', 'Z', 'E']) {
      if (categories.has(c) && !sellerTaxId) err('BT-31', `Seller VAT identifier is required for ${c === 'S' ? 'standard-rated' : c === 'Z' ? 'zero-rated' : 'exempt'} invoices (or give the seller tax number, BT-32)`);
    }
    if (categories.has('AE')) {
      if (!sellerTaxId) err('BT-31', 'Seller VAT identifier is required for reverse charge (AE) invoices');
      if (blank(buyer.vatId) && blank(typeof buyer.legalId === 'object' ? buyer.legalId?.id : buyer.legalId)) err('BT-48', 'Buyer VAT identifier (or legal registration identifier, BT-47) is required for reverse charge (AE) invoices');
    }
    if (categories.has('K')) {
      if (blank(seller.vatId)) err('BT-31', 'Seller VAT identifier is required for intra-community supplies (K)');
      if (blank(buyer.vatId)) err('BT-48', 'Buyer VAT identifier is required for intra-community supplies (K)');
      if (!isDate(invoice.delivery?.date) && !(isDate(invoice.delivery?.period?.start) && isDate(invoice.delivery?.period?.end))) err('BT-72', 'Actual delivery date or an invoicing period is required for intra-community supplies (K)');
    }
    if (categories.has('G') && blank(seller.vatId)) err('BT-31', 'Seller VAT identifier is required for export invoices (G)');
    if (categories.has('O')) {
      if (categories.size > 1) err('BT-151', 'Category O (not subject to VAT) cannot be mixed with other VAT categories in one invoice');
      if (!blank(seller.vatId)) err('BT-31', 'Seller VAT identifier must be left out when the invoice is not subject to VAT (O)');
      if (!blank(buyer.vatId)) err('BT-48', 'Buyer VAT identifier must be left out when the invoice is not subject to VAT (O)');
    }
  } else if (blank(seller.vatId) && blank(seller.taxNumber) && blank(typeof seller.legalId === 'object' ? seller.legalId?.id : seller.legalId)) {
    err('BT-31', 'Seller VAT identifier, tax number or legal registration identifier is required');
  }

  // Totals-dependent checks (exemption reasons, payment terms).
  let totals;
  if (errors.length === 0) {
    try { totals = computeTotals(invoice); } catch (e) { err('BG-22', `Totals could not be computed: ${e.message}`); }
  }
  if (totals && rank >= 1) {
    for (const g of totals.vatBreakdown) {
      if (EXEMPT_CATEGORIES.includes(g.category) && blank(g.exemptionReason) && blank(g.exemptionReasonCode)) {
        const label = { E: 'exempt (E)', AE: 'reverse charge (AE)', K: 'intra-community (K)', G: 'export (G)', O: 'not subject to VAT (O)' }[g.category];
        err('BT-120', `VAT exemption reason text or code (BT-121, for example ${{ E: 'VATEX-EU-132', AE: 'VATEX-EU-AE', K: 'VATEX-EU-IC', G: 'VATEX-EU-G', O: 'VATEX-EU-O' }[g.category]}) is required for ${label} amounts; set it on the line or in invoice.vatExemptions.${g.category}`);
      }
    }
    if (dec(totals.duePayable).n > 0n && !isDate(invoice.paymentTerms?.dueDate) && blank(invoice.paymentTerms?.description)) {
      err('BT-9', 'Payment due date or payment terms text (BT-20) is required when an amount is due');
    }
  }

  // Payment means.
  if (rank >= 1) {
    for (const pm of asList(invoice.paymentMeans)) {
      const code = String(pm?.code ?? '');
      if (blank(code)) { err('BT-81', 'Payment means type code is required'); continue; }
      if (['30', '58'].includes(code) && blank(pm.iban)) err('BT-84', `Payment account identifier (IBAN) is required for payment means ${code} (credit transfer)`);
      if (['48', '54', '55'].includes(code) && rank >= 3 && blank(pm.card?.number)) err('BT-87', `Payment card number (last 4 to 6 digits) is required for payment means ${code}`);
      if (pm.card?.number && String(pm.card.number).replace(/\D/g, '').length > 6) err('BT-87', 'Payment card number must contain only the last 4 to 6 digits, never the full card number');
      if (code === '59') {
        if (blank(invoice.paymentTerms?.directDebitMandateId)) err('BT-89', 'Mandate reference is required for SEPA direct debit (59)');
        if (blank(pm.debtorIban)) err('BT-91', 'Debited account identifier is required for SEPA direct debit (59)');
        if (blank(invoice.creditorReferenceId)) err('BT-90', 'Creditor reference (SEPA creditor identifier) is required for SEPA direct debit (59)');
      }
    }
  }

  if (xr) {
    if (blank(invoice.buyerReference)) err('BT-10', 'Buyer reference (Leitweg-ID) is required for XRechnung');
    const c = seller.contact || {};
    if (blank(c.name)) err('BT-41', 'Seller contact point name is required for XRechnung');
    if (blank(c.phone)) err('BT-42', 'Seller contact telephone number is required for XRechnung');
    else if ((String(c.phone).match(/\d/g) || []).length < 3) err('BT-42', 'Seller contact telephone number must contain at least three digits');
    if (blank(c.email)) err('BT-43', 'Seller contact email address is required for XRechnung');
    else if (!/^[^@\s]+@[^@\s]+$/.test(c.email) || /^\.|\.$/.test(c.email)) err('BT-43', 'Seller contact email address is not valid');
    if (blank(seller.address?.city)) err('BT-37', 'Seller city is required for XRechnung');
    if (blank(seller.address?.postcode)) err('BT-38', 'Seller post code is required for XRechnung');
    if (blank(buyer.address?.city)) err('BT-52', 'Buyer city is required for XRechnung');
    if (blank(buyer.address?.postcode)) err('BT-53', 'Buyer post code is required for XRechnung');
    if (blank(typeof seller.electronicAddress === 'object' ? seller.electronicAddress?.id : seller.electronicAddress)) err('BT-34', 'Seller electronic address is required for XRechnung');
    if (blank(typeof buyer.electronicAddress === 'object' ? buyer.electronicAddress?.id : buyer.electronicAddress)) err('BT-49', 'Buyer electronic address is required for XRechnung');
    if (asList(invoice.paymentMeans).length === 0) err('BG-16', 'Payment instructions (payment means) are required for XRechnung');
    if (!sellerTaxId && [...categories].some((c) => c !== 'O')) err('BT-31', 'Seller VAT identifier or tax number (BT-32) is required for XRechnung');
    if (invoice.delivery?.address) {
      if (blank(invoice.delivery.address.city)) err('BT-77', 'Deliver to city is required for XRechnung when a delivery address is given');
      if (blank(invoice.delivery.address.postcode)) err('BT-78', 'Deliver to post code is required for XRechnung when a delivery address is given');
    }
  }

  return errors;
}

/** Throw a single readable Error if the invoice is not ready for the profile. */
export function assertValidInvoice(invoice, profile) {
  const errors = validateInvoice(invoice, profile);
  if (errors.length) {
    const e = new Error(`Invoice is not valid for profile ${normalizeProfile(profile)}:\n- ${errors.map((x) => x.message).join('\n- ')}`);
    e.errors = errors;
    throw e;
  }
}
