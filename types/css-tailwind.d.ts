export { computeStylesForTree, resolveTailwindClasses, parseCssStylesheet } from './index.js';

export const TAILWIND_COLORS: Record<string, string | Record<string, string>>;
export function resolveCssVarsInString(text: string, vars?: Record<string, string>): string;
export function evaluateCalc(expression: string, availableWidth?: number, fontSize?: number): number;
export function evaluateCssValue(value: string, baseFontSize?: number, vars?: Record<string, string>): unknown;
export function splitSelectorList(selector: string): string[];
export function computeSelectorSpecificity(selector: string): number | number[];

declare const cssTailwind: {
  computeStylesForTree: typeof import('./index.js').computeStylesForTree;
  resolveTailwindClasses: typeof import('./index.js').resolveTailwindClasses;
  parseCssStylesheet: typeof import('./index.js').parseCssStylesheet;
  computeSelectorSpecificity: typeof computeSelectorSpecificity;
  splitSelectorList: typeof splitSelectorList;
  evaluateCssValue: typeof evaluateCssValue;
  evaluateCalc: typeof evaluateCalc;
  TAILWIND_COLORS: typeof TAILWIND_COLORS;
};
export default cssTailwind;
