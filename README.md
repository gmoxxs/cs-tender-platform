# C&S Tender Engineering Platform — Solar Farm / Solar Farm + BESS (Malaysia)

Browser-based civil & structural tender engineering tool: 62 transparent calculations (input → formula → result → check), QTO/BOQ, cost sensitivity, tender reconciliation & scope gaps, design risk register, standards / authority registers, and A4 report generation (print-to-PDF and Word .docx).

**Live app:** enable GitHub Pages (Settings → Pages → Deploy from branch → `main` / root). The app is served at `https://<your-username>.github.io/<repo-name>/`.

## Files
- `index.html` — the complete app (single self-contained file, no server needed)
- `src/` — source files; run `node build.js` to rebuild `dist/index.html`, then copy it to `index.html`
- `.nojekyll` — tells GitHub Pages to serve files as-is

## Google Sites
Insert → Embed → **By URL** → paste the GitHub Pages address.

## Notes
- Sample project values are **DEMONSTRATION DATA — NOT FOR DESIGN** (incl. IDF coefficients, flood level and rates).
- Calculations are preliminary / screening level; standards default to status VERIFY and clauses to "CLAUSE VERIFICATION REQUIRED".
- Project data is saved in the browser; use **Export JSON** to keep or share projects.

© IRDNA Sdn Bhd
