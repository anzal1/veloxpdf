# VeloxPDF fidelity against Chrome

Before the fixes in this change: 85.8 / 100.

Real MIT-licensed invoice and receipt templates (sources in fixtures/SOURCES.md), rendered by VeloxPDF and by headless Chrome at A4 with 0.5in margins.

**Overall fidelity score: 85.9 / 100** over 15 templates.

- Text coverage (share of Chrome's words VeloxPDF draws visibly inside the page): 99.2%
- Layout similarity (SSIM of page 1, grayscale, 300px wide): 0.690
- Page count matches Chrome: 13 of 15
- Template score = 0.4 text + 0.4 layout + 0.2 page count match

- Lost words (Chrome draws them, VeloxPDF does not): 15 in total. Extra overlaps (word boxes that intersect by over 20% in VeloxPDF and not in Chrome): 0 in total.

| Template | Text | Lost words | Extra overlaps | Layout | Pages (Velox / Chrome) | Score (before) |
|---|---|---|---|---|---|---|
| appsnipp-receipt | 100% | 0 (1) | 0 (2) | 0.85 | 1 / 1 | 94 (91) |
| cas8180-cash-receipt | 100% | 0 (0) | 0 (0) | 0.82 | 1 / 1 | 93 (93) |
| inambe-table | 100% | 0 (0) | 0 (0) | 0.67 | 1 / 1 | 87 (87) |
| lurepot-grid | 89% | 14 (14): amount authorised cost customer description disc. | 0 (0) | 0.51 | 2 / 2 | 76 (76) |
| paperplane-grid | 100% | 0 (0) | 0 (0) | 0.81 | 2 / 1 | 82 (82) |
| payrollflow-freelance | 99% | 1 (1): 0x. | 0 (0) | 0.66 | 1 / 1 | 86 (86) |
| sparksuite-plain | 100% | 0 (0) | 0 (0) | 0.83 | 1 / 1 | 93 (93) |
| tociva-corporate-sidebar | 100% | 0 (0) | 0 (0) | 0.74 | 2 / 2 | 90 (90) |
| tociva-minimalist | 100% | 0 (0) | 0 (0) | 0.67 | 2 / 2 | 87 (87) |
| tociva-navy-ledger | 100% | 0 (0) | 0 (0) | 0.61 | 1 / 1 | 84 (84) |
| tociva-neon-blue | 100% | 0 (0) | 0 (0) | 0.47 | 1 / 2 | 69 (69) |
| tociva-skyline | 100% | 0 (0) | 0 (0) | 0.75 | 1 / 1 | 90 (90) |
| tociva-skyline-long | 100% | 0 (0) | 0 (0) | 0.61 | 5 / 5 | 84 (84) |
| tociva-split-gradient | 100% | 0 (0) | 0 (0) | 0.73 | 3 / 3 | 89 (89) |
| tociva-vintage-gazette | 100% | 0 (0) | 0 (0) | 0.63 | 1 / 1 | 85 (85) |

Reproduce: `CHROME_PATH=... PLAYWRIGHT_CORE_PATH=... node scripts/fidelity/run.mjs --write-results` (needs pdftoppm, pdftotext and python3 with Pillow).
