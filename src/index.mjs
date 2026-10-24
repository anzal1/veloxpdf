import fs from 'node:fs';
import path from 'node:path';
import {
  compileTemplate,
  markdownToHtml,
  parseHtmlAndExecuteScripts,
  extractFromBrowserDOM,
} from './dom-vm.mjs';
import {
  computeStylesForTree,
  resolveTailwindClasses,
  parseCssStylesheet,
} from './css-tailwind.mjs';
import {
  layoutAndPaginate,
  measureTextWidth,
  wrapParagraphOptimal,
} from './layout-engine.mjs';
import {
  compilePagesToPdf,
  generateQrMatrix,
  generateCode128Bars,
  parseTrueTypeFont,
  extractEmbeddedData,
  registerFontData,
  buildPdfaXmp,
  PDFA_FONT_FILES,
} from './pdf-writer.mjs';
import {
  signPdf,
  signPdfBuffer,
  signPdfAsync,
  verifyPdfSignature,
  verifyPdfSignatureAsync,
  generateSelfSignedCert,
} from './pdf-signer.mjs';
import { compilePdfTemplate } from './parametric-compiler.mjs';
import { renderEInvoice, renderEInvoiceAsync, prepareEInvoice } from './einvoice/render.mjs';
import { buildInvoiceHtml } from './einvoice/template.mjs';
import {
  computeTotals,
  validateInvoice,
  assertValidInvoice,
  buildCiiXml,
  normalizeProfile,
  PROFILES as EINVOICE_PROFILES,
  PDF_EMBEDDING as EINVOICE_PDF_EMBEDDING,
} from './einvoice/index.mjs';
import { EXAMPLES as EINVOICE_EXAMPLES } from './einvoice/examples.mjs';

function getMimeType(buf, hint = '') {
  if (buf && buf.length >= 4) {
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
      return 'image/png';
    }
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      return 'image/jpeg';
    }
    if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
      return 'image/gif';
    }
    if (buf[0] === 0x3c && buf[1] === 0x73 && buf[2] === 0x76 && buf[3] === 0x67) {
      return 'image/svg+xml';
    }
  }
  const clean = String(hint || '').split('?')[0].split('#')[0].toLowerCase();
  if (clean.endsWith('.jpg') || clean.endsWith('.jpeg') || clean.includes('jpeg') || clean.includes('jpg')) {
    return 'image/jpeg';
  }
  if (clean.endsWith('.png') || clean.includes('png')) {
    return 'image/png';
  }
  if (clean.endsWith('.gif') || clean.includes('gif')) {
    return 'image/gif';
  }
  if (clean.endsWith('.svg') || clean.includes('svg')) {
    return 'image/svg+xml';
  }
  return 'image/png';
}
/**
 * Zero-Chromium HTML/CSS/Tailwind/Script/Canvas -> Vector PDF 1.7 Compiler.
 * Runs in Node.js, Bun, and Cloudflare Workers (nodejs_compat) with 0 npm dependencies.
 * Supported options:
 * - `data`: Object for template interpolation
 * - `format`: 'A4' | 'Letter' | 'Legal' | 'A3' | 'A5' | [width, height]
 * - `orientation`: 'portrait' | 'landscape'
 * - `margins` / `margin`: number | { top, bottom, left, right }
 * - `headerText`: string to render in page headers
 * - `footerText`: string to render in page footers
 * - `sign`: boolean | { certPem, keyPem, signerName, reason, location, org }
 * - `visualSeal`: boolean (renders green cryptographic seal on last page)
 * - `compress`: boolean (enables/disables FlateDecode page content streams)
 * - `returnMetrics`: boolean
 * - `runScripts`: boolean
 * - `pdfa`: '3b' (PDF/A-3b: embedded subset Liberation fonts, sRGB OutputIntent, XMP, trailer /ID)
 *   with `title`, `author`, `creationDate`, `extraXmp` (see the PDF/A section in pdf-writer.mjs)
 */
function htmlToPdf(htmlOrTemplate, options = {}) {
  const t0 = performance.now();
  let html = String(htmlOrTemplate || '');

  // 1. Parse HTML5 (with template interpolation) into Virtual DOM & execute inline `<script>` + `<canvas>.getContext('2d')`
  const domResult = parseHtmlAndExecuteScripts(html, {
    data: options.data || {},
    runScripts: options.runScripts !== false,
  });
  const rootNode = domResult.rootNode || domResult.document || domResult;

  // 2. Compute CSS cascade (`<style>`, `:nth-child`, `var()`, `calc()`, `@page`) + Tailwind utilities
  const styled = computeStylesForTree(rootNode, options);
  const tree = styled.rootNode || rootNode;

  // 3. Normalize page configuration with full support for format, orientation, margins, headerText, footerText, visualSeal
  const pageConfig = {
    ...(styled.pageConfig || {}),
    format: options.format || styled.pageConfig?.format || 'A4',
    orientation: options.orientation || styled.pageConfig?.orientation || 'portrait',
    margins: options.margins ?? options.margin ?? styled.pageConfig?.margins ?? styled.pageConfig?.margin,
    headerText: options.headerText !== undefined ? options.headerText : styled.pageConfig?.headerText,
    footerText: options.footerText !== undefined ? options.footerText : styled.pageConfig?.footerText,
    visualSeal: options.visualSeal !== undefined ? options.visualSeal : (Boolean(options.sign) ? true : false),
    ...options,
  };

  // 4. Solve 2D Block, Flexbox, CSS Grid, `<table>` (colspan, thead repeat, tfoot), & Multi-Page Pagination
  const layoutResult = layoutAndPaginate(tree, pageConfig, options);
  layoutResult.embeddedData = options.embeddedData !== undefined ? options.embeddedData : options.data;

  // 5. Emit native PDF 1.7 Vector Bytecode (`Uint8Array`)
  const compileOptions = {
    ...options,
    embeddedData: layoutResult.embeddedData,
  };
  if (options.pdfa && compileOptions.title === undefined) {
    const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    if (t) {
      let raw = t[1];
      if (raw.includes('{{')) {
        try { raw = compileTemplate(raw, options.data || {}); } catch { /* keep raw */ }
      }
      compileOptions.title = raw.replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim() || undefined;
    }
  }
  let pdfBytes = compilePagesToPdf(layoutResult, compileOptions);

  // 6. Optional X.509 / PKCS#7 Cryptographic Digital Signing (`Zomato/espresso` parity)
  if (options.sign) {
    const signOpts = typeof options.sign === 'object' ? options.sign : {};
    pdfBytes = signPdf(pdfBytes, signOpts);
  }
  const pageCount = layoutResult.pages?.length || 1;
  const elapsedMs = performance.now() - t0;
  pdfBytes.pdfBytes = pdfBytes;
  pdfBytes.pageCount = pageCount;
  pdfBytes.pages = pageCount;
  pdfBytes.elapsedMs = elapsedMs;

  if (options.returnMetrics) {
    return {
      pdfBytes,
      pageCount,
      elapsedMs,
      byteLength: pdfBytes.byteLength,
    };
  }
  return pdfBytes;
}

/**
 * Universal PDF render function (alias for `htmlToPdf`).
 */
const renderPdf = htmlToPdf;

const REMOTE_IMAGE_TIMEOUT_MS = 5000;
const REMOTE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

// PNG or JPEG only, decided from the bytes rather than the URL or Content-Type header.
function sniffRasterMime(buf) {
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  return null;
}

// Fetches a remote image with a 5 s timeout and a 5 MB cap. Returns a Buffer or null (never throws).
async function fetchRemoteImage(url) {
  if (typeof fetch !== 'function') return null;
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = setTimeout(() => ctrl?.abort(), REMOTE_IMAGE_TIMEOUT_MS);
  try {
    const res = await fetch(url, ctrl ? { signal: ctrl.signal } : undefined);
    if (!res.ok) return null;
    const declared = Number(res.headers?.get?.('content-length'));
    if (declared > REMOTE_IMAGE_MAX_BYTES) return null;
    if (res.body && typeof res.body.getReader === 'function') {
      const reader = res.body.getReader();
      const chunks = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > REMOTE_IMAGE_MAX_BYTES) {
          ctrl?.abort();
          return null;
        }
        chunks.push(value);
      }
      return Buffer.concat(chunks.map((c) => Buffer.from(c.buffer, c.byteOffset, c.byteLength)));
    }
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > REMOTE_IMAGE_MAX_BYTES ? null : buf;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Asynchronous Universal PDF render function:
 * Automatically resolves external/local <img> assets and custom TTF fonts before compiling and signing.
 */
async function renderPdfAsync(htmlOrTemplate, options = {}) {
  const t0 = performance.now();
  let html = String(htmlOrTemplate || '');

  // 1. If data is provided and template delimiters are present, interpolate template first
  if (options.data && html.includes('{{')) {
    html = compileTemplate(html, options.data);
  }

  // 2. Resolve <img> sources (file://, http(s)://, or local file paths in options.baseDir)
  const imgRegex = /<img\b([^>]*?)\bsrc=(["'])(.*?)\2([^>]*?)>/gi;
  const matches = [...html.matchAll(imgRegex)];
  if (matches.length > 0) {
    let replacedHtml = html;
    for (const match of matches) {
      const fullTag = match[0];
      const preAttr = match[1];
      const quote = match[2];
      const src = match[3];
      const postAttr = match[4];

      if (!src || src.startsWith('data:')) {
        continue;
      }

      let dataUrl = null;
      try {
        if (src.startsWith('http://') || src.startsWith('https://')) {
          const buf = await fetchRemoteImage(src);
          if (buf) {
            const mime = sniffRasterMime(buf);
            if (mime) dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
          }
        } else if (src.startsWith('file://')) {
          const filePath = src.startsWith('file://localhost/')
            ? decodeURIComponent(src.slice(16))
            : decodeURIComponent(src.replace(/^file:\/\//, ''));
          const buf = await fs.promises.readFile(filePath);
          const mime = getMimeType(buf, filePath);
          dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
        } else {
          const baseDir = options.baseDir || process.cwd();
          const resolvedPath = path.isAbsolute(src) ? src : path.resolve(baseDir, src);
          if (fs.existsSync(resolvedPath)) {
            const buf = await fs.promises.readFile(resolvedPath);
            const mime = getMimeType(buf, resolvedPath);
            dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
          }
        }
      } catch {
        // Fallback: leave src unchanged if resolving fails
      }

      if (dataUrl) {
        const newTag = `<img${preAttr}src=${quote}${dataUrl}${quote}${postAttr}>`;
        replacedHtml = replacedHtml.replace(fullTag, newTag);
      }
    }
    html = replacedHtml;
  }

  // 3. Resolve custom .ttf font files passed in options.fonts
  let resolvedFonts = options.fonts ? { ...options.fonts } : undefined;
  if (resolvedFonts) {
    for (const [fontFamily, fontVal] of Object.entries(resolvedFonts)) {
      if (typeof fontVal === 'string') {
        try {
          let fontBytes = null;
          if (fontVal.startsWith('http://') || fontVal.startsWith('https://')) {
            if (typeof fetch === 'function') {
              const res = await fetch(fontVal);
              if (res.ok) {
                const ab = await res.arrayBuffer();
                fontBytes = new Uint8Array(ab);
              }
            }
          } else if (fontVal.startsWith('file://')) {
            const fp = fontVal.startsWith('file://localhost/')
              ? decodeURIComponent(fontVal.slice(16))
              : decodeURIComponent(fontVal.replace(/^file:\/\//, ''));
            const b = await fs.promises.readFile(fp);
            fontBytes = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
          } else {
            const baseDir = options.baseDir || process.cwd();
            const fp = path.isAbsolute(fontVal) ? fontVal : path.resolve(baseDir, fontVal);
            if (fs.existsSync(fp)) {
              const b = await fs.promises.readFile(fp);
              fontBytes = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
            }
          }
          if (fontBytes && typeof parseTrueTypeFont === 'function') {
            resolvedFonts[fontFamily] = parseTrueTypeFont(fontBytes);
          }
        } catch {
          // Keep fontVal as is on error
        }
      } else if (
        (fontVal instanceof Uint8Array || Buffer.isBuffer(fontVal)) &&
        !fontVal.embedded &&
        typeof parseTrueTypeFont === 'function'
      ) {
        resolvedFonts[fontFamily] = parseTrueTypeFont(fontVal);
      }
    }
  }

  // 4. Render PDF synchronously through core pipeline with signing deferred
  const renderOptions = {
    ...options,
    fonts: resolvedFonts,
    sign: false,
    returnMetrics: false,
  };

  let pdfBytes = htmlToPdf(html, renderOptions);
  const pageCount = pdfBytes.pageCount || 1;

  // 5. Digital signing (WebCrypto async or standard sync)
  if (options.sign) {
    const signOpts = typeof options.sign === 'object' ? { ...options.sign } : {};
    if (options.useWebCrypto || signOpts.useWebCrypto) {
      pdfBytes = await signPdfAsync(pdfBytes, signOpts);
    } else {
      pdfBytes = signPdf(pdfBytes, signOpts);
    }
  }

  const elapsedMs = performance.now() - t0;
  pdfBytes.pdfBytes = pdfBytes;
  pdfBytes.pageCount = pageCount;
  pdfBytes.pages = pageCount;
  pdfBytes.elapsedMs = elapsedMs;

  if (options.returnMetrics) {
    return {
      pdfBytes,
      pageCount,
      elapsedMs,
      byteLength: pdfBytes.byteLength,
    };
  }

  return pdfBytes;
}

const htmlToPdfAsync = renderPdfAsync;
/**
 * Browser-Native DOM Element -> Vector PDF Compiler (`dompdf.js` drop-in replacement).
 */
function domToPdf(elementOrSelector, options = {}) {
  if (typeof elementOrSelector === 'string' && typeof document === 'undefined') {
    return htmlToPdf(elementOrSelector, options);
  }
  const el =
    typeof elementOrSelector === 'string'
      ? document.querySelector(elementOrSelector)
      : elementOrSelector;
  if (!el) {
    throw new Error('domToPdf: target element not found');
  }
  const extracted = extractFromBrowserDOM(el);
  if (typeof extracted === 'string') {
    return htmlToPdf(extracted, options);
  }
  const styled = computeStylesForTree(extracted, options);
  const pageConfig = {
    ...(styled.pageConfig || {}),
    format: options.format || styled.pageConfig?.format || 'A4',
    orientation: options.orientation || styled.pageConfig?.orientation || 'portrait',
    margins: options.margins ?? options.margin ?? styled.pageConfig?.margins ?? styled.pageConfig?.margin,
    headerText: options.headerText !== undefined ? options.headerText : styled.pageConfig?.headerText,
    footerText: options.footerText !== undefined ? options.footerText : styled.pageConfig?.footerText,
    visualSeal: options.visualSeal !== undefined ? options.visualSeal : (Boolean(options.sign) ? true : false),
    ...options,
  };
  const layoutResult = layoutAndPaginate(
    styled.rootNode || extracted,
    pageConfig,
    options,
  );
  let pdfBytes = compilePagesToPdf(layoutResult, options);
  if (options.sign) {
    pdfBytes = signPdf(pdfBytes, typeof options.sign === 'object' ? options.sign : {});
  }
  return pdfBytes;
}

/**
 * Drop-in `Zomato/espresso` replacement: renders an HTML template + JSON data and signs with X.509.
 */
function espressoRender(templateHtml, jsonData = {}, options = {}) {
  const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
  return htmlToPdf(templateHtml, {
    ...options,
    data,
    sign: options.sign ?? false,
  });
}

/**
 * Direct GFM Markdown -> Paginated Vector PDF 1.7 Compiler.
 */
function markdownToPdf(markdownStr, options = {}) {
  const bodyHtml = markdownToHtml(markdownStr);
  const fullHtml = `
    <!doctype html>
    <html>
      <head>
        <style>
          body { font-family: Helvetica, sans-serif; color: #0f172a; font-size: 11pt; line-height: 1.55; }
          h1 { font-size: 22pt; font-weight: bold; color: #090d16; margin-bottom: 10pt; border-bottom: 1pt solid #e2e8f0; padding-bottom: 6pt; }
          h2 { font-size: 15pt; font-weight: bold; color: #1e293b; margin-top: 14pt; margin-bottom: 6pt; }
          h3 { font-size: 12.5pt; font-weight: bold; color: #334155; margin-top: 10pt; margin-bottom: 4pt; }
          p { margin-bottom: 8pt; }
          pre, code { font-family: Courier, monospace; background-color: #f1f5f9; border-radius: 4pt; }
          pre { padding: 10pt; border: 1pt solid #cbd5e1; margin-bottom: 10pt; }
          blockquote { border-left: 3pt solid #6366f1; background-color: #f8fafc; padding: 8pt 12pt; margin-bottom: 10pt; color: #334155; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 12pt; }
          th { background-color: #0f172a; color: #ffffff; font-weight: bold; padding: 7pt 9pt; text-align: left; }
          td { border-bottom: 1pt solid #e2e8f0; padding: 6pt 9pt; }
          tr:nth-child(even) td { background-color: #f8fafc; }
        </style>
      </head>
      <body>${bodyHtml}</body>
    </html>
  `;
  return htmlToPdf(fullHtml, options);
}

export {
  renderPdf,
  renderEInvoice,
  renderEInvoiceAsync,
  prepareEInvoice,
  buildInvoiceHtml,
  computeTotals,
  validateInvoice,
  assertValidInvoice,
  buildCiiXml,
  normalizeProfile,
  EINVOICE_PROFILES,
  EINVOICE_PDF_EMBEDDING,
  EINVOICE_EXAMPLES,
  registerFontData,
  buildPdfaXmp,
  PDFA_FONT_FILES,
  renderPdfAsync,
  htmlToPdf,
  htmlToPdfAsync,
  domToPdf,
  espressoRender,
  markdownToPdf,
  compileTemplate,
  markdownToHtml,
  parseHtmlAndExecuteScripts,
  extractFromBrowserDOM,
  computeStylesForTree,
  resolveTailwindClasses,
  parseCssStylesheet,
  layoutAndPaginate,
  measureTextWidth,
  wrapParagraphOptimal,
  compilePagesToPdf,
  generateQrMatrix,
  generateCode128Bars,
  parseTrueTypeFont,
  extractEmbeddedData,
  signPdf,
  signPdfBuffer,
  signPdfAsync,
  verifyPdfSignature,
  verifyPdfSignatureAsync,
  generateSelfSignedCert,
  compilePdfTemplate,
};

export default {
  renderPdf,
  renderEInvoice,
  renderEInvoiceAsync,
  prepareEInvoice,
  buildInvoiceHtml,
  computeTotals,
  validateInvoice,
  assertValidInvoice,
  buildCiiXml,
  normalizeProfile,
  EINVOICE_PROFILES,
  EINVOICE_PDF_EMBEDDING,
  EINVOICE_EXAMPLES,
  registerFontData,
  buildPdfaXmp,
  PDFA_FONT_FILES,
  renderPdfAsync,
  htmlToPdf,
  htmlToPdfAsync,
  domToPdf,
  espressoRender,
  markdownToPdf,
  compileTemplate,
  markdownToHtml,
  parseHtmlAndExecuteScripts,
  extractFromBrowserDOM,
  computeStylesForTree,
  resolveTailwindClasses,
  parseCssStylesheet,
  layoutAndPaginate,
  measureTextWidth,
  wrapParagraphOptimal,
  compilePagesToPdf,
  generateQrMatrix,
  generateCode128Bars,
  parseTrueTypeFont,
  extractEmbeddedData,
  signPdf,
  signPdfBuffer,
  signPdfAsync,
  verifyPdfSignature,
  verifyPdfSignatureAsync,
  generateSelfSignedCert,
  compilePdfTemplate,
};
