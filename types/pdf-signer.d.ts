import type { CertOptions, SelfSignedCert } from './index.js';
export {
  signPdf,
  signPdfBuffer,
  signPdfAsync,
  verifyPdfSignature,
  verifyPdfSignatureAsync,
  generateSelfSignedCert,
} from './index.js';

/** Generate the identity with WebCrypto. Faster than the pure-JS generator in browsers. */
export function generateSelfSignedCertAsync(options?: CertOptions): Promise<SelfSignedCert>;
export function formatIncrementalXref(entries: Array<{ id: number; offset: number }>): string;
export const buildIncrementalXrefSubsections: typeof formatIncrementalXref;

declare const pdfSigner: {
  signPdf: typeof import('./index.js').signPdf;
  signPdfAsync: typeof import('./index.js').signPdfAsync;
  verifyPdfSignature: typeof import('./index.js').verifyPdfSignature;
  verifyPdfSignatureAsync: typeof import('./index.js').verifyPdfSignatureAsync;
  generateSelfSignedCert: typeof import('./index.js').generateSelfSignedCert;
  [key: string]: unknown;
};
export default pdfSigner;
