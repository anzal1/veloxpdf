# Fidelity corpus sources

All templates are MIT licensed. The copyright line of each repo is kept in an HTML comment at the top of the fixture.
`../prepare-fixtures.mjs` rebuilds the fixtures from clones of these commits. It only fills the sample data,
removes remote font stylesheets (so both engines use the same fallback font) and points logos at `placeholder-logo.png`
(a plain circle drawn for this corpus, CC0).

| Fixture | Style | Source file | Repo (stars) | Commit |
|---|---|---|---|---|
| sparksuite-plain | table, classic | invoice.html | https://github.com/sparksuite/simple-html-invoice-template (1.7k) | 7d74fe34c862b7712f1a23a3f12147a4a8bd53e1 |
| inambe-table | bordered tables, flex | invoice.html | https://github.com/Inambe/html-invoice-template | 2f29162197e67910f3f5cf7757c5452f7554c603 |
| payrollflow-freelance | flex, tables | templates/invoice-template.html | https://github.com/PayrollFlow/freelance-invoice-templates | b0ac50fde40961a897c060a5ffd871ecec2a0e9f |
| appsnipp-receipt | receipt, narrow column | bill.html | https://github.com/appsnipp/html-receipt | 628b80adae2a42880cb2f2d1c8a1e243d5be1971 |
| cas8180-cash-receipt | receipt, flex | receipt.html | https://github.com/cas8180/cash-receipt-template | 3af4459e68fe573c5c09d36f4e784f84560915be |
| lurepot-grid | CSS grid + flex, bootstrap-like classes inlined | invoice2css.html | https://github.com/LurePot/bootstrap-_invoice_html | c5c28c1bf27dcb882e1a414f7a0123dbe27665b0 |
| paperplane-grid | CSS grid, tables | invoice.html | https://github.com/paperplaneapp/html-invoice | fb7be520e267e0a21ad4b74149130ec0589950be |
| tociva-skyline | flex header band, striped table | public/invoice-templates/modern/skyline-invoice-template.html | https://github.com/tociva/free-invoice-generator | a4a69ec01dd834f5bbdb35a03484a908907a9844 |
| tociva-skyline-long | multi-page, 60 line items | same file as tociva-skyline | same | same |
| tociva-neon-blue | flex, gradient | .../freelancer/neon-blue.html | same | same |
| tociva-corporate-sidebar | flex sidebar | .../simple-design/corporate-sidebar.html | same | same |
| tociva-navy-ledger | flex, two tables | .../corporate/navy-ledger-invoice-template.html | same | same |
| tociva-vintage-gazette | flex, serif, transforms | .../simple-design/vintage-gazette.html | same | same |
| tociva-minimalist | flex, gradient, transforms | .../freelancer/minimalist.html | same | same |
| tociva-split-gradient | grid, absolute positioning, pseudo-elements, gradients | .../simple-design/split-gradient.html | same | same |

Skipped: templates that need JavaScript to render (nirajrajgor, barbosa89, vinay20045, Invoicebus) or an external
CSS framework that cannot be inlined (Bootstrap CDN: tahirtaous, sahrullahh, tudev).
The tociva repo is small (3 stars) but holds about 150 MIT templates in many layouts, which is why six fixtures come from it.
