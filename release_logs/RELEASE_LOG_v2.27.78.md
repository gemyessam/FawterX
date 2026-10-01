# FawterX Release Log - v2.27.78

**Release Date:** 2026-10-01  
**Build Target:** Production Web & Cloud Deployment  
**Target Project:** Canex Warehouse (`CANEX_WH`) Inventory Reconciliation & Pre-Reservation Architecture  

---

## Executive Summary
This release resolves the 4 residual phantom duplicate items in Canex Warehouse (`CANEX_WH`), achieving exact reconciliation at **36 SKUs**, **2,381 BAR**, and **13,037 LM**. It also resolves an architectural race condition in outbound stock reservation by enforcing pre-reservation item identity resolution.

---

## Problem Diagnosis & Root Cause
1. **Residual 4 Phantom Items:**
   - Out of the 15 phantom records created by outbound delivery note `SD-000000594` (`SO-00199` / `Sotalux`), 11 had finish `RALY22778SD` and 4 had `ANODIZED`, `RAL7009SD`, or supplier `SCHUCO`.
   - In `v2.27.77`, the filter specifically targeted `RALY22778SD`. The 4 remaining zero-balance records bypassed the filter and were resurrected into the active view (33 active + 3 legitimate zero-balance catalog items + 4 phantom items = 40 items).
2. **Outbound Reservation Invariant:**
   - In `warehouseStore.js`, `reserveStock` was called on the raw delivery note `itemKey` (which had coated finishes like `RALY22778SD` or supplier `SCHUCO`) before the profile was resolved to the raw Mill Finish (`MF`) stock item.
   - Calling reservation on a nonexistent key could fail or reserve against an incorrect key before the deduction fallback at line 1023.

---

## Architectural & Code Changes

### 1. Hardened Phantom Classifier (`backend/src/services/warehouseStore.js`)
- **Positive Inventory Invariant:** Explicitly guarantees that any record with positive physical balance (`quantityBar !== 0 || quantityLm !== 0`) is never classified as phantom.
- **Exact-Zero Artifact Enforcement:** Identifies and eliminates all 15 phantom artifacts (`SO-00199`, `Sotalux`, `SD-000000594`, `RALY22778SD`, `ANODIZ`, `RAL7009`, `RAL*`, `SCHUCO`).
- **Catalog Membership Scope:** For `CANEX_WH`, catalog resurrection from the `items` collection is strictly restricted to raw Mill Finish (`MF`) profiles from supplier `CANEX`.

### 2. Pre-Reservation Identity Resolution (`backend/src/services/warehouseStore.js`)
- In both `processInboundInvoice` and `processManualStockMovement`, when processing an outbound movement (`isOutbound === true`):
  - Resolves `effectiveItemKey` to the existing raw Mill Finish profile in `stock` *before* calling `reserveStock()`.
  - Uses `effectiveItemKey` consistently across `reserveStock()`, `movementData.itemKey`, and `batch.update(stockRef)`.

### 3. Frontend Alignment (`frontend/src/pages/Warehouse.jsx`)
- Updated `loadStock(projectId)` to synchronize with backend filtering logic, excluding coated finishes (`ANODIZ`, `RAL7009`, `RAL*`) and `SCHUCO` prefixes on exact zero-balance records.
- Guarantees instant client-side rendering of exactly 36 SKUs.

### 4. Unit & Regression Tests (`frontend/tests/warehouseCoating.test.mjs`)
- Expanded test coverage to verify elimination of metadata-free `ANODIZED`, `RAL7009SD`, and `SCHUCO` phantom records.
- Added explicit assertions verifying that positive inventory balances are protected even with customer/sales order tags.

---

## Verification & Test Results
- **Frontend Unit Tests:** 8/8 tests passed (`warehouseCoating.test.mjs`).
- **Backend Jest Suites:** 75/75 tests passed across 5 suites.
- **Production Build:** `npm --prefix frontend run build` completed with 0 errors in 4.11s.
- **Target Invariants:**
  - Active SKUs: **36 items** (33 with positive balance + 3 legitimate zero-balance catalog items).
  - Total Bars: **2,381 BAR**.
  - Total Length: **13,037 LM**.
