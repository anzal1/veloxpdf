// Factur-X / ZUGFeRD / XRechnung structured invoice data (UN/CEFACT CII, EN 16931).
// Zero dependencies. See model.mjs for the invoice shape.

export {
  PROFILES,
  GUIDELINE_IDS,
  XRECHNUNG_BUSINESS_PROCESS,
  PDF_EMBEDDING,
  FACTURX_XMP,
  VAT_CATEGORIES,
  EXEMPT_CATEGORIES,
  DOCUMENT_TYPE_CODES,
  normalizeProfile,
  profileRank,
} from './model.mjs';
export { computeTotals, money, decimalString } from './totals.mjs';
export { validateInvoice, assertValidInvoice } from './validate.mjs';
export { buildCiiXml, escapeXml, formatDate102 } from './cii.mjs';
