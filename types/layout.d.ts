import type { VNode } from './index.js';
export { layoutAndPaginate, measureTextWidth, wrapParagraphOptimal } from './index.js';

export function extractSvgPaths(
  svgNode: VNode,
  parentFill?: string | null,
  parentStroke?: string | null,
  parentStrokeWidth?: number | null,
  currentColor?: string,
): unknown;
/** Alias of `extractSvgPaths`. */
export const extractSvgSpec: typeof extractSvgPaths;
