# Release Log - FawterX v2.27.52

**Release Date:** September 3, 2026  
**Type:** Feature & Data Correction Tooling  
**Component:** Warehouse History View, Valuation Actions, Batch Reconciliation

---

## Summary of Changes

### 1. Retroactive Cost Reconciliation Actions
- **Row-Level Cost Fix:**
  - Added a dedicated `⚡ تصحيح التكلفة` (Fix Cost) action button directly in each outbound invoice row in the transaction history table.
  - Clicking this button immediately triggers backend re-valuation for that specific invoice, recalculating every line's bar cost and net total against the source inbound invoice.
- **Global Header Re-Evaluation Button:**
  - Enhanced the History header with a prominent action: `💰 ⚡ تحديث التكلفة الحقيقية (1.29M)` to recalculate all historical outbound movements project-wide.

### 2. Enhanced Source Invoice In-Depth Lookup
- Upgraded `resolveCanonicalItemCost` Level 1 to search both `invoiceId` and `invoiceNumber`.
- Enabled 5-character prefix matching in source invoices so that Schüco codes (like `515750`) seamlessly inherit the pricing of corresponding Canex items (like `515756`).

---

## Verification & Deployment
- **Pre-Build Verification:** Clean build with 0 warnings/errors via `npm run build` in 4.90s.
- **Firebase Hosting:** Deployed to `https://fawterx.web.app`.
- **Git Push:** Remote main updated with automatic backend redeployment on Render.
