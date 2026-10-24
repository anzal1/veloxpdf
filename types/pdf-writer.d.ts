import type { ParsedTrueTypeFont } from './index.js';
export {
  compilePagesToPdf,
  generateQrMatrix,
  generateCode128Bars,
  parseTrueTypeFont,
  extractEmbeddedData,
  registerFontData,
  buildPdfaXmp,
  PDFA_FONT_FILES,
} from './index.js';

/** Alias of `compilePagesToPdf`. */
export const writePdfDocument: typeof import('./index.js').compilePagesToPdf;

export function parseHexColor(color: string, currentColorRgb?: number[] | null): number[] | null;
export function pdfEscapeText(text: string): string;
export function buildMinimalTrueTypeFont(options?: {
  fontName?: string;
  unitsPerEm?: number;
  ascent?: number;
  descent?: number;
  [key: string]: unknown;
}): Uint8Array;
export function generateToUnicodeCMap(cmap: Map<number, number>, fontName?: string): string;
export function roundedRectPath(
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number | number[],
): string;
export function multiplySvgTransforms(m1: number[], m2: number[]): number[];
export function parseSvgTransform(transform: string): number[];
export function arcToCubicBeziers(
  x1: number,
  y1: number,
  rx: number,
  ry: number,
  angleDeg: number,
  largeArcFlag: number,
  sweepFlag: number,
  x2: number,
  y2: number,
): number[][];
export function parseSvgPath(
  d: string,
  transformPtOrScaleX: unknown,
  scaleY?: number,
  offsetX?: number,
  offsetY?: number,
  pdfH?: number,
): unknown;
export type { ParsedTrueTypeFont };
