# Changelog

All notable changes to this project are listed here. The format follows Keep a Changelog and the project uses semantic versioning.

## 0.1.0 - first public release

First release on npm. The engine itself was built before this version; 0.1.0 is the packaging and the agent interface around it.

### Engine

- Renders HTML, CSS and Tailwind utility classes to vector PDF 1.7 with no browser and no DOM. The package has zero runtime dependencies.
- Page sizes A4, Letter and Legal, portrait or landscape, custom width and height in points, margins, running header and footer text, single-page mode, optional stream compression.
- Layout for block flow, flexbox, CSS grid and tables (column spans, repeated header rows, footers), with pagination across pages.
- Go-style and Handlebars-style `{{ }}` templates with loops and conditions. The data passed to a render is embedded in the PDF as a JSON attachment and can be read back with `extractEmbeddedData`.
- Inline SVG, QR codes, Code 128 barcodes, Markdown input, TrueType font embedding.
- X.509 signing with a PKCS#7 detached signature written as an incremental update, with a synchronous API and a WebCrypto API. `verifyPdfSignature` checks the signed byte ranges and reports tampering.
- PDF/A-3b output mode (`pdfa: '3b'`) with embedded, subset Liberation fonts and XMP metadata. The fonts ship in the package under `fonts/`.
- `compilePdfTemplate` compiles a template once and renders it again with new data.
- Runs in Node.js 22 and later, Bun, Cloudflare Workers (`nodejs_compat`) and the browser through `veloxpdf/browser`.

### Packaging

- ESM package with an `exports` map: the main entry plus `veloxpdf/dom-vm`, `veloxpdf/css-tailwind`, `veloxpdf/layout`, `veloxpdf/pdf-writer`, `veloxpdf/pdf-signer`, `veloxpdf/browser` and `veloxpdf/package.json`.
- TypeScript declarations for the public API in `types/`. No `@types` packages are needed to consume them.
- `veloxpdf` command: `render`, `verify`, `bench` and `serve` (the Studio web UI).
- `sideEffects` is declared for bundlers: only the browser bundle has one, because it sets `window.VeloxPDF`.

### MCP server

- New `veloxpdf-mcp` command: a Model Context Protocol server over stdio with no dependencies, protocol version 2025-06-18 (2025-03-26 and 2024-11-05 are also accepted).
- Tools: `render_pdf`, `sign_pdf`, `verify_pdf`, `extract_pdf_data`.
- Files are read and written only under the server root folder (the working directory, or `VELOXPDF_MCP_ROOT`). `VELOXPDF_MCP_ALLOW_OUTSIDE_ROOT=1` lifts the limit. Written files must end in `.pdf`.
- Rendering through the server does not fetch remote images and does not run inline scripts unless asked.

### Project

- GitHub Actions: tests on Node 22 and 24, a browser bundle build, and a release workflow that publishes to npm with provenance through trusted publishing when `package.json` carries a version that is not on npm yet.
- Monthly Dependabot updates grouped into one pull request.

### Measured on one machine

Node 24.20.0, macOS arm64, `veloxpdf bench` with the invoice preset and 50 iterations: warm `htmlToPdf` median 2.10 ms, precompiled template median 0.01 ms. The test suite has 26 tests and all pass. Run `veloxpdf bench` to measure on your own machine.
