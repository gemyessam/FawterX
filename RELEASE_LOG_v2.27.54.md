# Release Log - FawterX v2.27.54

**Release Date:** September 3, 2026  
**Type:** Feature Enhancement & Single Source of Truth Financial Reconciliation  
**Component:** Warehouse Dispatches, Batch Review (Schüco SD), Pricing Alignment

---

## Summary of Changes

### 1. Root-Cause Analysis & Pricing Discrepancy Elimination
- **Source of Previous Discrepancy:**
  - Delmar Outbound Dispatches: 933 bars (5,082.0 m) totaling **1,323,034.51 EGP** as reconciled from original Canex source invoices.
  - Schüco Delivery Note (Items 1-15): 928 bars (5,053.0 m) totaling **1,293,746.04 EGP** due to stale local estimates before reconciliation, missing alias price mapping for 515750/515756, and physical exclusion of the 5 extra bars.
- **5-Bar Quantity & Meter Breakdown:**
  - Extra bars remaining in Delmar: Item 4 (`504690`: +1 bar), Item 6 (`511900`: +2 bars), Item 9 (`515660`: +1 bar), Item 10 (`515680`: +1 bar) = 5 bars (29.0 m).

### 2. Single Source of Truth (SSOT) Architecture
- **Direct Dispatch Price Resolution:**
  - Enriched `getDelmarPool` to carry `barPrice`, `unitPrice`, `lengthMm`, and `netTotal` from active dispatches.
  - Dynamically resolved each line in Schüco SD batch against the Delmar pool and warehouse stock using aliases.
- **1-Click / Real-Time Pricing Synchronization:**
  - Added `handleSyncBatchPrices` button (`🔄 مزامنة وتوحيد الأسعار`) in the batch header to immediately propagate Delmar dispatch unit & bar prices to all review lines.
- **Reconciled Header Badges:**
  - Added Delmar Remaining Balance Pill: Shows remaining bars and their exact value (`delmarRemainingBars` & `delmarRemainingCost`).
  - Mathematical integrity: $\text{Schüco Cost (928 bars)} + \text{Remaining Delmar Stock (5 bars)} = \text{Total Delmar Invoices (933 bars, 1,323,034.51 EGP)}$.

---

## Verification & Deployment
- **Pre-Build Verification:** Clean build with `npm run build` in 4.94s.
- **Firebase Hosting:** Deployed to `https://fawterx.web.app`.
- **Git Push:** Remote main updated with automatic backend redeployment on Render.
