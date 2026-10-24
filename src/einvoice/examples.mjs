// Sample invoices, one per common case. Used by the tests and handy as templates.

const deSeller = {
  name: 'Lieferant Technik GmbH',
  legalId: 'HRB 123456',
  vatId: 'DE123456789',
  taxNumber: '201/113/40209',
  address: { line1: 'Lindenstraße 12', city: 'Berlin', postcode: '10115', country: 'DE' },
  contact: { name: 'Anna Schmidt', phone: '+49 30 1234567', email: 'buchhaltung@lieferant.example' },
  electronicAddress: { id: 'rechnung@lieferant.example', scheme: 'EM' },
};

const deBuyer = {
  name: 'Kunde & Partner AG',
  vatId: 'DE987654321',
  address: { line1: 'Hafenweg 3', city: 'Hamburg', postcode: '20457', country: 'DE' },
  contact: { name: 'Jonas Weber', email: 'einkauf@kunde.example' },
  electronicAddress: { id: 'einkauf@kunde.example', scheme: 'EM' },
};

/** (a) German B2B EN16931 invoice: 19% and 7% VAT, document-level discount, SEPA credit transfer. */
export const germanB2B = {
  number: 'RE-2026-0042',
  issueDate: '2026-10-20',
  typeCode: '380',
  currency: 'EUR',
  buyerReference: 'PO-77812',
  orderReference: 'PO-77812',
  seller: deSeller,
  buyer: deBuyer,
  delivery: { date: '2026-10-15' },
  notes: ['Vielen Dank für Ihren Auftrag.', { content: 'Lieferant Technik GmbH, Geschäftsführer: Max Muster', subjectCode: 'REG' }],
  lines: [
    { id: '1', name: 'Beratung Systemintegration', description: 'Workshop vor Ort', quantity: 12.5, unitCode: 'HUR', netPrice: '95.00', vatCategory: 'S', vatRate: 19 },
    { id: '2', name: 'Fachbuch "PDF & XML"', quantity: 3, unitCode: 'C62', netPrice: '24.95', vatCategory: 'S', vatRate: 7 },
    { id: '3', name: 'Supportpauschale', quantity: 1, unitCode: 'MON', netPrice: '149.00', vatCategory: 'S', vatRate: 19,
      allowances: [{ percent: 10, reason: 'Treuerabatt', reasonCode: '95' }] },
  ],
  allowances: [{ amount: '50.00', reason: 'Rabatt Rahmenvertrag', reasonCode: '95', vatCategory: 'S', vatRate: 19 }],
  charges: [{ amount: '9.90', reason: 'Versand', reasonCode: 'FC', vatCategory: 'S', vatRate: 7 }],
  paymentTerms: { dueDate: '2026-11-19', description: 'Zahlbar innerhalb von 30 Tagen ohne Abzug' },
  paymentMeans: { code: '58', iban: 'DE89 3704 0044 0532 0130 00', bic: 'COBADEFFXXX', accountName: 'Lieferant Technik GmbH' },
  paymentReference: 'RE-2026-0042',
};

/** (b) French BASIC invoice: 20% and 5.5% VAT, SIREN as legal ID. */
export const frenchBasic = {
  number: 'FA-2026-118',
  issueDate: '2026-10-21',
  currency: 'EUR',
  orderReference: 'BC-5521',
  seller: {
    name: 'Atelier Durand SARL',
    legalId: { id: '732829320', scheme: '0002' },
    vatId: 'FR40732829320',
    address: { line1: '8 rue des Lilas', city: 'Lyon', postcode: '69003', country: 'FR' },
    electronicAddress: { id: 'factures@durand.example', scheme: 'EM' },
  },
  buyer: {
    name: 'Boulangerie Martin',
    legalId: { id: '552100554', scheme: '0002' },
    vatId: 'FR32552100554',
    address: { line1: '2 place du Marché', city: 'Villeurbanne', postcode: '69100', country: 'FR' },
    electronicAddress: { id: '552100554', scheme: '0225' },
  },
  delivery: { date: '2026-10-18' },
  notes: [
    { content: 'Pénalités de retard : 3 fois le taux d\'intérêt légal.', subjectCode: 'PMD' },
    { content: 'Indemnité forfaitaire pour frais de recouvrement : 40 EUR.', subjectCode: 'PMT' },
    { content: 'Pas d\'escompte pour paiement anticipé.', subjectCode: 'AAB' },
  ],
  lines: [
    { id: '1', name: 'Réparation four', quantity: 3, unitCode: 'HUR', netPrice: '65.00', vatCategory: 'S', vatRate: 20 },
    { id: '2', name: 'Farine T65 (sac 25 kg)', quantity: 4, unitCode: 'C62', netPrice: '18.37', vatCategory: 'S', vatRate: 5.5 },
  ],
  paymentTerms: { dueDate: '2026-11-20', description: 'Paiement à 30 jours' },
  paymentMeans: { code: '30', iban: 'FR76 3000 6000 0112 3456 7890 189' },
};

/** (c) Credit note (381) referring to the invoice it corrects. */
export const creditNote = {
  number: 'GS-2026-0007',
  issueDate: '2026-10-22',
  typeCode: '381',
  currency: 'EUR',
  buyerReference: 'PO-77812',
  precedingInvoice: { number: 'RE-2026-0042', date: '2026-10-20' },
  seller: deSeller,
  buyer: deBuyer,
  delivery: { date: '2026-10-15' },
  notes: ['Gutschrift für zurückgesandte Fachbücher.'],
  lines: [{ id: '1', name: 'Fachbuch "PDF & XML" (Rücksendung)', quantity: 2, unitCode: 'C62', netPrice: '24.95', vatCategory: 'S', vatRate: 7 }],
  paymentTerms: { description: 'Der Betrag wird auf Ihr Konto erstattet.' },
  paymentMeans: { code: '58', iban: 'DE02120300000000202051' },
};

/** (d) XRechnung 3.0 invoice to a German public buyer. */
export const xrechnung = {
  number: 'XR-2026-0815',
  issueDate: '2026-10-23',
  currency: 'EUR',
  buyerReference: '04011000-12345-34',
  seller: deSeller,
  buyer: {
    name: 'Bezirksamt Mitte von Berlin',
    address: { line1: 'Karl-Marx-Allee 31', city: 'Berlin', postcode: '10178', country: 'DE' },
    electronicAddress: { id: '04011000-12345-34', scheme: '0204' },
  },
  delivery: { period: { start: '2026-09-01', end: '2026-09-30' } },
  lines: [
    { id: '1', name: 'Wartung Druckerflotte', quantity: 1, unitCode: 'MON', netPrice: '480.00', vatCategory: 'S', vatRate: 19 },
    { id: '2', name: 'Vor-Ort-Einsatz', quantity: 2, unitCode: 'DAY', netPrice: '720.00', vatCategory: 'S', vatRate: 19 },
  ],
  paymentTerms: { dueDate: '2026-11-22', description: 'Zahlbar innerhalb von 30 Tagen' },
  paymentMeans: { code: '58', iban: 'DE89370400440532013000', bic: 'COBADEFFXXX' },
};

/** (e) MINIMUM invoice: only header data and totals go into the XML. */
export const minimum = {
  number: 'MIN-1',
  issueDate: '2026-10-24',
  currency: 'EUR',
  buyerReference: 'REF-1',
  seller: { name: 'Lieferant Technik GmbH', vatId: 'DE123456789', address: { country: 'DE' } },
  buyer: { name: 'Kunde & Partner AG' },
  lines: [{ id: '1', name: 'Pauschale', quantity: 1, unitCode: 'C62', netPrice: '100.00', vatCategory: 'S', vatRate: 19 }],
};

/** (f) Intra-EU reverse charge (AE) service from Germany to France. */
export const reverseCharge = {
  number: 'RE-2026-0050',
  issueDate: '2026-10-24',
  currency: 'EUR',
  buyerReference: 'FR-PO-31',
  seller: deSeller,
  buyer: {
    name: 'Studio Lumière SAS',
    vatId: 'FR32552100554',
    address: { line1: '14 avenue Foch', city: 'Paris', postcode: '75116', country: 'FR' },
  },
  delivery: { date: '2026-10-10' },
  lines: [
    { id: '1', name: 'Softwareentwicklung', quantity: 40, unitCode: 'HUR', netPrice: '110.00', vatCategory: 'AE', vatRate: 0 },
    { id: '2', name: 'Lizenz Bibliothek (12 Monate)', quantity: 1, unitCode: 'C62', netPrice: '1200.00', vatCategory: 'AE', vatRate: 0 },
  ],
  vatExemptions: { AE: { reason: 'Reverse charge: Steuerschuldnerschaft des Leistungsempfängers', code: 'VATEX-EU-AE' } },
  paymentTerms: { dueDate: '2026-11-23' },
  paymentMeans: { code: '58', iban: 'DE89370400440532013000', bic: 'COBADEFFXXX' },
};

/** BASIC WL invoice (header only, no lines in the XML). */
export const basicWl = { ...frenchBasic, number: 'FA-2026-119' };

export const EXAMPLES = {
  germanB2B: { invoice: germanB2B, profile: 'EN16931' },
  frenchBasic: { invoice: frenchBasic, profile: 'BASIC' },
  creditNote: { invoice: creditNote, profile: 'EN16931' },
  xrechnung: { invoice: xrechnung, profile: 'XRECHNUNG' },
  minimum: { invoice: minimum, profile: 'MINIMUM' },
  reverseCharge: { invoice: reverseCharge, profile: 'EN16931' },
  basicWl: { invoice: basicWl, profile: 'BASICWL' },
};
