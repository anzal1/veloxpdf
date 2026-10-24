import type { ParsedDocument, VNode } from './index.js';
export { compileTemplate, markdownToHtml, parseHtmlAndExecuteScripts, extractFromBrowserDOM } from './index.js';

export function decodeHtmlEntities(text: string): string;
export function matchesSelector(element: VNode, selectorGroup: string): boolean;
export function createTextNode(text: string, parent?: VNode | null, options?: Record<string, unknown>): VNode;
export function createElement(
  tagName: string,
  attrs?: Record<string, string>,
  parent?: VNode | null,
  ownerDocument?: VNode | null,
): VNode;

declare const domVm: {
  compileTemplate: typeof import('./index.js').compileTemplate;
  markdownToHtml: typeof import('./index.js').markdownToHtml;
  parseHtmlAndExecuteScripts: (html: string, options?: { data?: Record<string, unknown>; runScripts?: boolean }) => ParsedDocument;
  extractFromBrowserDOM: typeof import('./index.js').extractFromBrowserDOM;
  [key: string]: unknown;
};
export default domVm;
