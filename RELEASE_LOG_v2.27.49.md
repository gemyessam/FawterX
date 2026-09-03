# Release Log - FawterX v2.27.49

**Release Date:** September 3, 2026  
**Type:** Feature Enhancement & Financial Summary  
**Component:** Warehouse Delivery / Outbound Review, Metrics Strip & Table Footer

---

## Summary of Changes

### 1. Total Cost / Value Metric Pill (`مجموع التكلفة`)
- Integrated a new prominent metric badge in the executive summary strip displaying the total financial cost of the outbound dispatch order (`SD`):
  - Calculates line-by-line net totals or fallback unit/bar cost multiplications.
  - Automatically respects the invoice currency (`EGP` or specified currency) with proper 2-decimal formatting.

### 2. Comprehensive Table Footer (`<tfoot>`)
- Added a full-width summary footer row directly below the line items table:
  - **Bars Sum:** Total requested bars (`totalSdBars`).
  - **Linear Meters Sum:** Total meters (`totalSdLm`).
  - **Weight Sum:** Total kilograms (`totalSdKg`).
  - **Net Total / Cost:** Formatted total value and currency aligned exactly under the Total column.

---

## Verification & Deployment
- **Pre-Build Verification:** Passed cleanly with 0 errors via `npm run build`.
- **Firebase Hosting:** Deployed to `https://fawterx.web.app`.
- **Git Commit:** Committed and pushed to remote main branch (GitHub & Render).
