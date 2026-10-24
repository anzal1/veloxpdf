// renderEInvoice: invoice model -> PDF/A-3b with the CII XML embedded (Factur-X / ZUGFeRD / XRechnung).
//
// One source of truth: computeTotals(invoice) runs once; the visible page is built from those
// totals and the XML from buildCiiXml, and the key amounts of the XML are checked against the
// same totals before anything is rendered, so the printed invoice and the XML cannot disagree.

import { normalizeProfile, PDF_EMBEDDING, FACTURX_XMP } from './model.mjs';
import { computeTotals } from './totals.mjs';
import { assertValidInvoice } from './validate.mjs';
import { buildCiiXml } from './cii.mjs';
import { buildInvoiceHtml, buildInvoiceView } from './template.mjs';
import { htmlToPdf, renderPdfAsync } from '../index.mjs';

/** Factur-X XMP: the fx: Description plus the pdfaExtension schema that declares it (PDF/A 6.6.2.3). */
export function facturxXmp({ fileName, conformanceLevel }) {
  const ns = FACTURX_XMP.namespaceUri;
  const prop = (name, description) => `<rdf:li rdf:parseType="Resource">
<pdfaProperty:name>${name}</pdfaProperty:name>
<pdfaProperty:valueType>Text</pdfaProperty:valueType>
<pdfaProperty:category>external</pdfaProperty:category>
<pdfaProperty:description>${description}</pdfaProperty:description>
</rdf:li>`;
  const extension = `<rdf:Description rdf:about="" xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/" xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#" xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">
<pdfaExtension:schemas>
<rdf:Bag>
<rdf:li rdf:parseType="Resource">
<pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>
<pdfaSchema:namespaceURI>${ns}</pdfaSchema:namespaceURI>
<pdfaSchema:prefix>${FACTURX_XMP.prefix}</pdfaSchema:prefix>
<pdfaSchema:property>
<rdf:Seq>
${prop('DocumentFileName', 'Name of the embedded XML invoice file')}
${prop('DocumentType', 'INVOICE')}
${prop('Version', 'The actual version of the Factur-X XML schema')}
${prop('ConformanceLevel', 'The conformance level of the embedded Factur-X data')}
</rdf:Seq>
</pdfaSchema:property>
</rdf:li>
</rdf:Bag>
</pdfaExtension:schemas>
</rdf:Description>`;
  const fx = `<rdf:Description rdf:about="" xmlns:fx="${ns}">
<fx:DocumentType>${FACTURX_XMP.documentType}</fx:DocumentType>
<fx:DocumentFileName>${fileName}</fx:DocumentFileName>
<fx:Version>${FACTURX_XMP.version}</fx:Version>
<fx:ConformanceLevel>${conformanceLevel}</fx:ConformanceLevel>
</rdf:Description>`;
  return [fx, extension];
}

function xmlAmount(xml, tag) {
  const m = new RegExp(`<ram:${tag}(?:\\s[^>]*)?>([^<]*)</ram:${tag}>`).exec(xml);
  return m ? m[1] : undefined;
}

/**
 * Builds everything renderEInvoice needs without rendering: validated invoice, totals, XML,
 * HTML and the htmlToPdf options. Exposed for callers that want to inspect or post-process.
 */
export function prepareEInvoice(invoice, options = {}) {
  const {
    profile: profileOpt = 'EN16931',
    template,
    title,
    embedPayload = false,
    ...renderOptions
  } = options;
  const profile = normalizeProfile(profileOpt);
  // Lines without an id (BT-126) are numbered 1, 2, 3 in order; the caller's object is not changed.
  if (Array.isArray(invoice?.lines) && invoice.lines.some((line) => line && (line.id === undefined || line.id === ''))) {
    invoice = { ...invoice, lines: invoice.lines.map((line, i) => (line && (line.id === undefined || line.id === '') ? { ...line, id: String(i + 1) } : line)) };
  }
  assertValidInvoice(invoice, profile); // readable error listing every missing business term
  const totals = computeTotals(invoice);
  const xml = buildCiiXml(invoice, { profile, validate: false });

  // Guard: the XML must carry exactly the totals the page prints.
  for (const [tag, key] of [['GrandTotalAmount', 'grandTotal'], ['DuePayableAmount', 'duePayable'], ['TaxBasisTotalAmount', 'taxBasisTotal'], ['TaxTotalAmount', 'taxTotal']]) {
    const inXml = xmlAmount(xml, tag);
    if (inXml !== undefined && inXml !== totals[key]) {
      throw new Error(`VeloxPDF e-invoice: XML ${tag} ${inXml} differs from computed ${key} ${totals[key]}`);
    }
  }

  const embedding = PDF_EMBEDDING[profile];
  const view = buildInvoiceView(invoice, totals, { profile, conformanceLevel: embedding.conformanceLevel });
  const html = template
    ? String(template)
    : buildInvoiceHtml(invoice, totals, { profile, conformanceLevel: embedding.conformanceLevel });

  const xmlFile = {
    name: embedding.fileName,
    data: xml,
    mimeType: 'text/xml',
    afRelationship: embedding.afRelationship,
    description: profile === 'XRECHNUNG' ? 'XRechnung invoice' : `Factur-X/ZUGFeRD invoice (${embedding.conformanceLevel})`,
    modDate: renderOptions.creationDate,
  };
  const extraXmp = [
    ...facturxXmp({ fileName: embedding.fileName, conformanceLevel: embedding.conformanceLevel }),
    ...(Array.isArray(renderOptions.extraXmp) ? renderOptions.extraXmp : renderOptions.extraXmp ? [renderOptions.extraXmp] : []),
  ];
  const pdfOptions = {
    format: 'A4',
    runScripts: false,
    ...renderOptions,
    pdfa: '3b',
    title: title || `${view.title} ${invoice.number}`,
    author: renderOptions.author || invoice.seller?.name || 'VeloxPDF',
    extraXmp,
    embeddedFiles: [xmlFile, ...(renderOptions.embeddedFiles || [])],
    // Template data for custom templates; the JSON payload attachment stays off unless asked for.
    data: template ? { invoice, totals, profile, conformanceLevel: embedding.conformanceLevel, view } : undefined,
    embedData: embedPayload === true,
    embeddedData: embedPayload === true ? { invoice, totals } : undefined,
  };
  if (embedPayload === true && !template) pdfOptions.data = { invoice, totals };
  return { profile, totals, xml, html, view, embedding, pdfOptions };
}

/**
 * Render an e-invoice (PDF/A-3b + embedded CII XML).
 * options: profile ('EN16931' default; MINIMUM, BASICWL, BASIC, XRECHNUNG), template (custom HTML
 * using { invoice, totals, profile, conformanceLevel, view }), sign (true or signPdf options),
 * title, creationDate, embedPayload (also attach velox-payload.json), plus any htmlToPdf option.
 * Returns the PDF bytes (Uint8Array) with .xml, .totals and .profile attached for convenience.
 */
export function renderEInvoice(invoice, options = {}) {
  const prep = prepareEInvoice(invoice, options);
  const pdf = htmlToPdf(prep.html, prep.pdfOptions);
  return decorate(pdf, prep);
}

/** Same as renderEInvoice, through renderPdfAsync (remote images, WebCrypto signing with useWebCrypto). */
export async function renderEInvoiceAsync(invoice, options = {}) {
  const prep = prepareEInvoice(invoice, options);
  const pdf = await renderPdfAsync(prep.html, prep.pdfOptions);
  return decorate(pdf, prep);
}

function decorate(pdf, prep) {
  const bytes = pdf && pdf.pdfBytes ? pdf.pdfBytes : pdf;
  try {
    bytes.xml = prep.xml;
    bytes.totals = prep.totals;
    bytes.profile = prep.profile;
  } catch { /* frozen or primitive, ignore */ }
  return bytes;
}
