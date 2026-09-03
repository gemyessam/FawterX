# Release Log - FawterX v2.27.53

**Release Date:** September 3, 2026  
**Type:** UI/UX & Layout Stabilization  
**Component:** Warehouse History Table, Column Dimensions, Badge Formatting

---

## Summary of Changes

### 1. Table Column Stabilization & Layout Cleanup
- **Movement Type Column:**
  - Fixed dimensions (`width: 130px`, `minWidth: 130px`) with centered alignment.
  - Sized the badge container with `minWidth: 105px` and `whiteSpace: nowrap` to prevent awkward wrapping.
- **Bars / Profiles Column:**
  - Stabilized dimensions (`width: 145px`, `minWidth: 145px`) with centered alignment.
  - Styled the count and `BAR` badge on a clean, single horizontal line with `display: inline-flex` and `gap: 0.35rem`, eliminating vertical text wrapping.
- **Line Items, Meters, Total, Date Columns:**
  - Explicit fixed min-widths assigned to prevent any horizontal jitter or resizing.

### 2. Removal of Temporary Cost Correction Buttons
- Removed the row-level `⚡ تصحيح التكلفة` buttons and header bulk reconciliation button, as all future manual dispatches and imports now calculate canonical valuation automatically at creation time.

---

## Verification & Deployment
- **Pre-Build Verification:** Clean build with 0 warnings/errors via `npm run build` in 4.82s.
- **Firebase Hosting:** Deployed to `https://fawterx.web.app`.
- **Git Push:** Remote main updated with automatic backend redeployment on Render.
