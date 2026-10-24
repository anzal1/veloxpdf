/**
 * Invoice model for Factur-X / ZUGFeRD (UN/CEFACT CII, EN 16931).
 *
 * All amounts, prices, quantities and rates may be given as numbers or as
 * decimal strings ("19.99"). Strings are recommended for exact values; numbers
 * are converted with their shortest decimal form, so 0.1 stays 0.1.
 * Dates may be "YYYY-MM-DD", "YYYYMMDD" or a Date (UTC calendar day is used).
 *
 * @typedef {Object} Address
 * @property {string} [line1]        BT-35 / BT-50 / BT-75
 * @property {string} [line2]        BT-36 / BT-51 / BT-76
 * @property {string} [line3]        BT-162 / BT-163 / BT-165
 * @property {string} [city]         BT-37 / BT-52 / BT-77
 * @property {string} [postcode]     BT-38 / BT-53 / BT-78
 * @property {string} [subdivision]  BT-39 / BT-54 / BT-79 (region, state)
 * @property {string} country        BT-40 / BT-55 / BT-80, ISO 3166-1 alpha-2 ("DE")
 *
 * @typedef {Object} Contact
 * @property {string} [name]         BT-41 / BT-56
 * @property {string} [department]
 * @property {string} [phone]        BT-42 / BT-57
 * @property {string} [email]        BT-43 / BT-58
 *
 * @typedef {Object} SchemeId
 * @property {string} id
 * @property {string} [scheme]       ISO 6523 ICD ("0002" SIREN, "0088" GLN) or EAS code
 *
 * @typedef {Object} Party
 * @property {string} name                    BT-27 / BT-44
 * @property {string} [tradingName]           BT-28 / BT-45
 * @property {string} [id]                    BT-29 / BT-46 (seller/buyer identifier)
 * @property {SchemeId} [globalId]            BT-29 / BT-46 with scheme (GLN etc.)
 * @property {string|SchemeId} [legalId]      BT-30 / BT-47 legal registration identifier
 * @property {string} [description]           BT-33 additional legal information (seller only, EN16931)
 * @property {string} [vatId]                 BT-31 / BT-48 ("DE123456789")
 * @property {string} [taxNumber]             BT-32 local tax registration (schemeID "FC")
 * @property {Address} address                BG-5 / BG-8
 * @property {Contact} [contact]              BG-6 / BG-9 (EN16931 and XRECHNUNG)
 * @property {string|SchemeId} [electronicAddress] BT-34 / BT-49; a plain string is treated as an email (scheme "EM")
 *
 * @typedef {Object} AllowanceCharge
 * @property {number|string} [amount]         BT-92/BT-99 (document) or BT-136/BT-141 (line)
 * @property {number|string} [percent]        BT-94/BT-101 or BT-138/BT-143
 * @property {number|string} [baseAmount]     BT-93/BT-100 or BT-137/BT-142; needed with percent
 *                                            (defaults to the line net amount before allowances on lines)
 * @property {string} [reason]                BT-97/BT-104 or BT-139/BT-144
 * @property {string} [reasonCode]            BT-98/BT-105 (UNTDID 5189 for allowances, 7161 for charges)
 * @property {string} [vatCategory]           BT-95/BT-102, document level only (S, Z, E, AE, K, G, O)
 * @property {number|string} [vatRate]        BT-96/BT-103, document level only
 * @property {string} [exemptionReason]       BT-120 for its VAT group
 * @property {string} [exemptionReasonCode]   BT-121 for its VAT group (VATEX code)
 *
 * @typedef {Object} LineItem
 * @property {string} id                      BT-126
 * @property {string} name                    BT-153
 * @property {string} [description]           BT-154 (EN16931)
 * @property {string} [note]                  BT-127
 * @property {string} [sellerItemId]          BT-155 (EN16931)
 * @property {string} [buyerItemId]           BT-156 (EN16931)
 * @property {SchemeId} [standardId]          BT-157 (GTIN with scheme "0160")
 * @property {string} [orderLineReference]    BT-132 (EN16931)
 * @property {number|string} quantity         BT-129
 * @property {string} unitCode                BT-130, UN/ECE Rec 20 ("C62" piece, "HUR" hour, "DAY")
 * @property {number|string} netPrice         BT-146 net unit price
 * @property {number|string} [grossPrice]     BT-148
 * @property {number|string} [basisQuantity]  BT-149 price base quantity (default 1)
 * @property {string} vatCategory             BT-151 (S, Z, E, AE, K, G, O)
 * @property {number|string} [vatRate]        BT-152 (omit for O)
 * @property {{start:string|Date,end:string|Date}} [period] BG-26
 * @property {AllowanceCharge[]} [allowances] BG-27
 * @property {AllowanceCharge[]} [charges]    BG-28
 * @property {string} [exemptionReason]       BT-120 for this line's VAT group
 * @property {string} [exemptionReasonCode]   BT-121 for this line's VAT group
 *
 * @typedef {Object} PaymentMeans
 * @property {string} code                    BT-81, UNTDID 4461: "58" SEPA credit transfer, "30" credit
 *                                            transfer, "59" SEPA direct debit, "48"/"54"/"55" card, "10" cash
 * @property {string} [information]           BT-82 (EN16931)
 * @property {string} [iban]                  BT-84 payee account (required for 30 and 58)
 * @property {string} [accountName]           BT-85 (EN16931)
 * @property {string} [bic]                   BT-86 (EN16931)
 * @property {{number:string, holder?:string}} [card] BT-87 (last 4 to 6 digits only) / BT-88 (EN16931)
 * @property {string} [debtorIban]            BT-91 for direct debit
 *
 * @typedef {Object} Invoice
 * @property {string} number                  BT-1
 * @property {string|Date} issueDate          BT-2
 * @property {string} [typeCode]              BT-3: "380" invoice (default), "381" credit note, "384", "389"
 * @property {string} currency                BT-5 ISO 4217 ("EUR")
 * @property {string} [taxCurrency]           BT-6
 * @property {string} [buyerReference]        BT-10 (XRechnung: Leitweg-ID)
 * @property {string} [orderReference]        BT-13
 * @property {string} [contractReference]     BT-12
 * @property {{number:string, date?:string|Date}} [precedingInvoice] BG-3 (BT-25, BT-26), useful on credit notes
 * @property {string} [businessProcess]       BT-23
 * @property {Party} seller                   BG-4
 * @property {Party} buyer                    BG-7
 * @property {{date?:string|Date, period?:{start:string|Date,end:string|Date}, name?:string, address?:Address}} [delivery]
 *                                            BT-72 actual delivery date, BG-14 invoicing period, BG-13 deliver to
 * @property {LineItem[]} lines               BG-25 (needed for every profile; totals are computed from them)
 * @property {AllowanceCharge[]} [allowances] BG-20
 * @property {AllowanceCharge[]} [charges]    BG-21
 * @property {{dueDate?:string|Date, description?:string, directDebitMandateId?:string}} [paymentTerms] BT-9, BT-20, BT-89
 * @property {PaymentMeans|PaymentMeans[]} [paymentMeans] BG-16
 * @property {string} [paymentReference]      BT-83 remittance information
 * @property {string} [creditorReferenceId]   BT-90 SEPA creditor identifier (direct debit)
 * @property {Array<string|{content:string, subjectCode?:string}>} [notes] BG-1
 * @property {number|string} [prepaidAmount]  BT-113
 * @property {Object<string,{reason?:string, code?:string}>} [vatExemptions]
 *                                            exemption reason per VAT category, e.g. { AE: { reason: 'Reverse charge', code: 'VATEX-EU-AE' } }
 */

/** Supported profiles, lowest to highest. */
export const PROFILES = ['MINIMUM', 'BASICWL', 'BASIC', 'EN16931', 'XRECHNUNG'];

/**
 * Guideline IDs (BT-24) as used by Factur-X 1.07 / ZUGFeRD 2.3 and by the
 * Mustang validator (org.mustangproject.ZUGFeRD.Profiles).
 */
export const GUIDELINE_IDS = {
  MINIMUM: 'urn:factur-x.eu:1p0:minimum',
  BASICWL: 'urn:factur-x.eu:1p0:basicwl',
  BASIC: 'urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:basic',
  EN16931: 'urn:cen.eu:en16931:2017',
  XRECHNUNG: 'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0',
};

/** Business process (BT-23) written for XRECHNUNG when the invoice does not set one. */
export const XRECHNUNG_BUSINESS_PROCESS = 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0';

/**
 * What the PDF/A-3 embedding step needs per profile:
 * attachment file name, /AFRelationship and the XMP fx:ConformanceLevel.
 */
export const PDF_EMBEDDING = {
  MINIMUM: { fileName: 'factur-x.xml', afRelationship: 'Data', conformanceLevel: 'MINIMUM' },
  BASICWL: { fileName: 'factur-x.xml', afRelationship: 'Data', conformanceLevel: 'BASIC WL' },
  BASIC: { fileName: 'factur-x.xml', afRelationship: 'Alternative', conformanceLevel: 'BASIC' },
  EN16931: { fileName: 'factur-x.xml', afRelationship: 'Alternative', conformanceLevel: 'EN 16931' },
  XRECHNUNG: { fileName: 'xrechnung.xml', afRelationship: 'Alternative', conformanceLevel: 'XRECHNUNG' },
};

/** XMP extension schema values shared by every profile. */
export const FACTURX_XMP = {
  namespaceUri: 'urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#',
  prefix: 'fx',
  documentType: 'INVOICE',
  version: '1.0',
};

export const VAT_CATEGORIES = ['S', 'Z', 'E', 'AE', 'K', 'G', 'O', 'L', 'M'];
export const EXEMPT_CATEGORIES = ['E', 'AE', 'K', 'G', 'O'];
export const DOCUMENT_TYPE_CODES = ['380', '381', '384', '389', '261', '386', '751', '326', '875', '876', '877'];

export function profileRank(profile) {
  const p = normalizeProfile(profile);
  return { MINIMUM: 0, BASICWL: 1, BASIC: 2, EN16931: 3, XRECHNUNG: 3 }[p];
}

export function normalizeProfile(profile = 'EN16931') {
  const p = String(profile).toUpperCase().replace(/[\s_-]/g, '');
  const map = { MINIMUM: 'MINIMUM', BASICWL: 'BASICWL', BASIC: 'BASIC', EN16931: 'EN16931', COMFORT: 'EN16931', XRECHNUNG: 'XRECHNUNG' };
  if (!map[p]) throw new Error(`Unknown e-invoice profile "${profile}". Use one of ${PROFILES.join(', ')}.`);
  return map[p];
}
