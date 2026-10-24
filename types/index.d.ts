/**
 * Type declarations for veloxpdf.
 * No Node or DOM typings are required to consume this file.
 */

/** Page sizes the layout engine knows. Names are case-insensitive. Any other name falls back to A4. */
export type PageFormat = 'A4' | 'Letter' | 'Legal' | 'a4' | 'letter' | 'legal';

/** Page margins in PDF points (1 pt = 1/72 inch). Default is 36 on every side. */
export interface Margins {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

/** A parsed TrueType font as returned by `parseTrueTypeFont`. */
export interface ParsedTrueTypeFont {
  embedded: boolean;
  byteLength?: number;
  rawBytes?: Uint8Array;
  cmap?: Map<number, number>;
  widths?: Map<number, number>;
  numGlyphs?: number;
  bbox?: number[];
  measureChar?(codePoint: number | string, fontSize?: number): number;
  [key: string]: unknown;
}

/** A font value: TTF bytes, a parsed font, or (async API only) a path, file:// URL or http(s) URL. */
export type FontSource = Uint8Array | ParsedTrueTypeFont | string;

/** Options for `signPdf`, `signPdfAsync` and the `sign` render option. */
export interface SignOptions {
  /** PEM encoded X.509 certificate. Needs `keyPem` as well. When both are missing a self-signed certificate is generated. */
  certPem?: string;
  /** PEM encoded RSA private key (PKCS#8). */
  keyPem?: string;
  /** DER encoded certificate. Used with `cryptoKey` in `signPdfAsync`. */
  certDer?: Uint8Array;
  /** WebCrypto RSASSA-PKCS1-v1_5 SHA-256 private key. Only `signPdfAsync` uses it. */
  cryptoKey?: object;
  /** Alias for `cryptoKey`. */
  privateKey?: object;
  /** Name shown as the signer and used as the common name of a generated certificate. Default "VeloxPDF Authority". */
  signerName?: string;
  /** Default "Cryptographic Attestation". */
  reason?: string;
  /** Default "San Francisco, US". */
  location?: string;
  /** Organization of a generated certificate. Default "VeloxPDF Inc.". */
  org?: string;
  /** Signing time written into the signature. Default is now. */
  signingTime?: Date;
  /** In `renderPdfAsync`, sign with WebCrypto instead of the synchronous path. */
  useWebCrypto?: boolean;
}

/** Options accepted by the render functions. */
export interface RenderOptions {
  /** Data for `{{ }}` templates. Also embedded in the PDF as a JSON attachment unless `embedData` is false. */
  data?: Record<string, unknown>;
  /** Named page size. Default "A4". */
  format?: PageFormat;
  /** Page width in points. Overrides the width of `format`. */
  width?: number;
  /** Page height in points. Overrides the height of `format`. */
  height?: number;
  /** Default "portrait". */
  orientation?: 'portrait' | 'landscape';
  /** Margins in points. A number applies to all sides. */
  margins?: number | Margins;
  /** Alias for `margins`. */
  margin?: number | Margins;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  /** Running header text on every page. */
  headerText?: string;
  /** Running footer text. Supports "{{page}}" and "{{pages}}". */
  footerText?: string;
  /** Sign the PDF. `true` signs with a generated self-signed certificate. */
  sign?: boolean | SignOptions;
  /** Draw the visual seal on the last page. Defaults to true when `sign` is set. */
  visualSeal?: boolean;
  /** Compress page content streams with FlateDecode. Off unless true. */
  compress?: boolean;
  /** Put everything on one page, no pagination. */
  singlePage?: boolean;
  /** Return `{ pdfBytes, pageCount, elapsedMs, byteLength }` instead of the bytes. */
  returnMetrics?: boolean;
  /** Run inline `<script>` and `<canvas>` code. Default true. */
  runScripts?: boolean;
  /** Extra CSS applied before the document's own styles. */
  css?: string;
  /** TrueType fonts keyed by font family name, or a list of fonts. */
  fonts?: Record<string, FontSource> | Array<FontSource | { name: string; data: FontSource }>;
  /** A single TrueType font. */
  font?: FontSource;
  /** A single TrueType font. */
  ttf?: FontSource;
  /** Directory used to resolve relative `<img>` and font paths in `renderPdfAsync`. Default is the working directory. */
  baseDir?: string;
  /** Set to false to skip embedding the JSON payload. */
  embedData?: boolean;
  /** JSON to embed instead of `data`. */
  embeddedData?: unknown;
  /** Used by `renderPdfAsync` to sign with WebCrypto. */
  useWebCrypto?: boolean;
  /**
   * Write a PDF/A-3b file: fonts are embedded (Liberation fonts replace the standard 14), with XMP metadata and an sRGB output intent.
   * `true` means '3b'. Any other level throws. Off by default.
   * In runtimes without node:fs, call `registerFontData` for each name in `PDFA_FONT_FILES` first.
   */
  pdfa?: boolean | '3b';
  /** Document title for PDF/A metadata. When absent and `pdfa` is on, the HTML `<title>` is used. */
  title?: string;
  /** Author for PDF/A metadata. Default "VeloxPDF". */
  author?: string;
  /** Date for PDF/A metadata. A fixed date makes the output byte-reproducible. Default is now. */
  creationDate?: Date | string;
  /** Raw `<rdf:Description>` XMP blocks inserted into the PDF/A metadata packet. Used for Factur-X and ZUGFeRD. */
  extraXmp?: string | string[];
}

/** PDF bytes with some extra properties attached by the renderer. */
export type PdfBytes = Uint8Array & {
  /** The same bytes. */
  pdfBytes: Uint8Array;
  pageCount: number;
  /** Same as `pageCount`. */
  pages: number;
  elapsedMs: number;
};

/** The result when `returnMetrics: true`. */
export interface RenderMetrics {
  pdfBytes: PdfBytes;
  pageCount: number;
  elapsedMs: number;
  byteLength: number;
}

/** Result of `verifyPdfSignature` and `verifyPdfSignatureAsync`. */
export interface VerifyResult {
  /** True when the digest and signature check out. */
  valid: boolean;
  /** True when the file changed after signing or the signature is malformed. */
  tamperDetected: boolean;
  /** Present when `valid` is false. */
  error?: string;
  signerName?: string;
  reason?: string;
  location?: string;
  signingTime?: string;
  signedAt?: string;
  /** `[start1, length1, start2, length2]` of the signed byte ranges. */
  byteRange?: [number, number, number, number];
  certSubject?: string;
  sha256Fingerprint?: string;
  subFilter?: string;
  /** SHA-256 of the signed bytes, hex. */
  digestHex?: string;
}

/** Self-signed identity from `generateSelfSignedCert`. */
export interface SelfSignedCert {
  certPem: string;
  keyPem: string;
  certDer: Uint8Array;
  commonName: string;
  org: string;
  /** Only on the async generator. */
  cryptoKey?: object | null;
}

export interface CertOptions {
  commonName?: string;
  org?: string;
  country?: string;
}

/** What `compilePdfTemplate` returns. Call it as a function or use `.render`. */
export interface CompiledTemplate {
  (data?: Record<string, unknown>): CompiledPdfBytes;
  render(data?: Record<string, unknown>): CompiledPdfBytes;
  readonly pageCount: number;
  readonly slotCount: number;
  readonly instructionCount: number;
  exportPlan(): {
    width: number;
    height: number;
    slotDefs: Array<{ id: string; expr: string; sampleVal: string }>;
    instructionList: unknown[];
    pages: unknown[];
  };
}

/** Bytes returned by a compiled template. `pages` is a list here, not a count. */
export type CompiledPdfBytes = Uint8Array & {
  pdfBytes: Uint8Array;
  pageCount: number;
  pages: unknown[];
};

export interface CompileTemplateOptions {
  css?: string;
  format?: PageFormat;
  orientation?: 'portrait' | 'landscape';
  margins?: number | Margins;
  width?: number;
  height?: number;
  [key: string]: unknown;
}

/** A node in the virtual DOM used by the engine. Treat it as opaque unless you are extending the engine. */
export interface VNode {
  type?: string;
  tagName?: string;
  children?: VNode[];
  computedStyle?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ParsedDocument extends VNode {
  readonly document: VNode;
  readonly rootNode: VNode;
}

export interface PageConfig {
  format?: PageFormat;
  width?: number;
  height?: number;
  orientation?: 'portrait' | 'landscape';
  margins?: number | Margins;
  [key: string]: unknown;
}

export interface LayoutResult {
  pages: Array<{ width: number; height: number; items: unknown[]; links: unknown[] }>;
  [key: string]: unknown;
}

export interface TextStyle {
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  textTransform?: string;
  [key: string]: unknown;
}

/** Barcode modules from `generateCode128Bars`: an array of bar widths plus metadata. */
export type Code128Bars = number[] & {
  totalModules: number;
  symbols: number[];
  value: string;
};

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export function htmlToPdf(html: string, options: RenderOptions & { returnMetrics: true }): RenderMetrics;
export function htmlToPdf(html: string, options?: RenderOptions & { returnMetrics?: false }): PdfBytes;
export function htmlToPdf(html: string, options?: RenderOptions): PdfBytes | RenderMetrics;

/** Alias of `htmlToPdf`. */
export const renderPdf: typeof htmlToPdf;

export function renderPdfAsync(html: string, options: RenderOptions & { returnMetrics: true }): Promise<RenderMetrics>;
export function renderPdfAsync(html: string, options?: RenderOptions & { returnMetrics?: false }): Promise<PdfBytes>;
export function renderPdfAsync(html: string, options?: RenderOptions): Promise<PdfBytes | RenderMetrics>;

/** Alias of `renderPdfAsync`. */
export const htmlToPdfAsync: typeof renderPdfAsync;

/** Render a DOM element (browser) or an HTML string. Browser use is meant for the bundle at `veloxpdf/browser`. */
export function domToPdf(elementOrSelector: string | object, options?: RenderOptions): PdfBytes;

/** Render a template with JSON data. `jsonData` may be an object or a JSON string. Signs only when `options.sign` is set. */
export function espressoRender(
  templateHtml: string,
  jsonData?: Record<string, unknown> | string,
  options?: RenderOptions,
): PdfBytes;

/** Render GitHub-flavoured Markdown. */
export function markdownToPdf(markdown: string, options?: RenderOptions): PdfBytes;

/** Compile a template once, then render it many times with different data. */
export function compilePdfTemplate(
  htmlTemplate: string,
  sampleData?: Record<string, unknown>,
  options?: CompileTemplateOptions,
): CompiledTemplate;

// ---------------------------------------------------------------------------
// Signing and verifying
// ---------------------------------------------------------------------------

export function signPdf(pdfBytes: Uint8Array, options?: SignOptions): Uint8Array;
/** Alias of `signPdf`. */
export const signPdfBuffer: typeof signPdf;
export function signPdfAsync(pdfBytes: Uint8Array, options?: SignOptions): Promise<Uint8Array>;
export function verifyPdfSignature(signedPdfBytes: Uint8Array, options?: Record<string, unknown>): VerifyResult;
export function verifyPdfSignatureAsync(
  signedPdfBytes: Uint8Array,
  options?: Record<string, unknown>,
): Promise<VerifyResult>;
export function generateSelfSignedCert(options?: CertOptions): SelfSignedCert;

/** Read the JSON that `render` embedded in a PDF. Returns null when there is none. */
export function extractEmbeddedData<T = unknown>(pdfBytes: Uint8Array): T | null;

// ---------------------------------------------------------------------------
// Lower level pieces
// ---------------------------------------------------------------------------

export function compileTemplate(template: string, data?: Record<string, unknown>): string;
export function markdownToHtml(markdown: string): string;
export function parseHtmlAndExecuteScripts(
  html: string,
  options?: { data?: Record<string, unknown>; runScripts?: boolean },
): ParsedDocument;
export function extractFromBrowserDOM(rootElement: string | object): VNode;
export function computeStylesForTree(rootNode: VNode, options?: { css?: string; [key: string]: unknown }): {
  rootNode: VNode;
  pageConfig: PageConfig;
};
export function resolveTailwindClasses(classNames: string): Record<string, unknown>;
export function parseCssStylesheet(css: string, media?: string): unknown;
export function layoutAndPaginate(rootNode: VNode, pageConfig?: PageConfig, options?: RenderOptions): LayoutResult;
export function measureTextWidth(text: string, style?: TextStyle): number;
export function wrapParagraphOptimal(text: string, maxWidth: number, style?: TextStyle): string[];
export function compilePagesToPdf(layoutResult: LayoutResult, options?: RenderOptions): Uint8Array;
/** QR code as rows of 0/1 modules. Version 1 to 10, byte mode. */
export function generateQrMatrix(value?: string): number[][];
export function generateCode128Bars(value?: string): Code128Bars;
export function parseTrueTypeFont(ttfBytes: Uint8Array): ParsedTrueTypeFont;

/** Font file names that PDF/A mode needs. In Node they load from the package's fonts folder. */
export const PDFA_FONT_FILES: string[];
/** Supply font bytes where node:fs is unavailable (the browser bundle). `name` is a file name from `PDFA_FONT_FILES`. */
export function registerFontData(name: string, bytes: Uint8Array | ArrayBuffer): void;
export interface PdfaXmpOptions {
  title?: string;
  author?: string;
  producer?: string;
  creatorTool?: string;
  dates?: unknown;
  documentId?: string;
  instanceId?: string;
  extraXmp?: string | string[];
  part?: number;
  conformance?: string;
}
/** Build the PDF/A XMP packet. */
export function buildPdfaXmp(options: PdfaXmpOptions): string;

declare const veloxpdf: {
  renderPdf: typeof renderPdf;
  renderPdfAsync: typeof renderPdfAsync;
  htmlToPdf: typeof htmlToPdf;
  htmlToPdfAsync: typeof htmlToPdfAsync;
  domToPdf: typeof domToPdf;
  espressoRender: typeof espressoRender;
  markdownToPdf: typeof markdownToPdf;
  compileTemplate: typeof compileTemplate;
  markdownToHtml: typeof markdownToHtml;
  parseHtmlAndExecuteScripts: typeof parseHtmlAndExecuteScripts;
  extractFromBrowserDOM: typeof extractFromBrowserDOM;
  computeStylesForTree: typeof computeStylesForTree;
  resolveTailwindClasses: typeof resolveTailwindClasses;
  parseCssStylesheet: typeof parseCssStylesheet;
  layoutAndPaginate: typeof layoutAndPaginate;
  measureTextWidth: typeof measureTextWidth;
  wrapParagraphOptimal: typeof wrapParagraphOptimal;
  compilePagesToPdf: typeof compilePagesToPdf;
  generateQrMatrix: typeof generateQrMatrix;
  generateCode128Bars: typeof generateCode128Bars;
  parseTrueTypeFont: typeof parseTrueTypeFont;
  registerFontData: typeof registerFontData;
  buildPdfaXmp: typeof buildPdfaXmp;
  PDFA_FONT_FILES: typeof PDFA_FONT_FILES;
  extractEmbeddedData: typeof extractEmbeddedData;
  signPdf: typeof signPdf;
  signPdfBuffer: typeof signPdfBuffer;
  signPdfAsync: typeof signPdfAsync;
  verifyPdfSignature: typeof verifyPdfSignature;
  verifyPdfSignatureAsync: typeof verifyPdfSignatureAsync;
  generateSelfSignedCert: typeof generateSelfSignedCert;
  compilePdfTemplate: typeof compilePdfTemplate;
};
export default veloxpdf;
