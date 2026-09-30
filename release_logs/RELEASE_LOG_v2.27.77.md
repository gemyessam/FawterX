# FawterX Release Log - v2.27.77

**Release Date:** 2026-09-30  
**Deployment Target:** Firebase Hosting (`https://fawterx.web.app`) & Render Backend Sync  
**Domain / Scope:** Warehouse / Deterministic 36 SKUs Reconciliation / Inbound-Only Creation Lock  

---

## 1. Problem Statement & Root Cause
- **Trigger / User Feedback:** The user noted that Canex Warehouse displayed 33 SKUs instead of 36 SKUs, and demanded to know why outbound dispatches were ever creating new codes/items or duplicates just because an item was dispatched.
- **Root Cause Analysis:**
  1. **Disappearance of 3 items (33 instead of 36):** An indiscriminate zero-stock purge routine had moved all records with `<= 0` balance into `deletedStock`. Three legitimate original catalog items with 0 balance were moved into `deletedStock`, reducing the visible SKU count from 36 to 33.
  2. **Generation of 15 phantom duplicates:** When outbound delivery note `SD-000000594` was processed, its lines had painted finish `RALY22778SD` for customer `Sotalux` / order `SO-00199`. Because warehouse stock is stored as raw Mill Finish (`MF`), `itemKey` did not match, and `batch.set(..., { merge: true })` created 15 duplicate documents in `stock` and `items`.

---

## 2. Established Invariants & Architectural Rulings
- **Invariant [Inbound-Only Creation]:** Outbound delivery notes / sales invoices / dispatches (`movementType === 'outbound'`) are strictly forbidden from creating new records in `stock` or `items`. They may ONLY deduct from existing project stock.
- **Invariant [Outbound Finish Resolution]:** If an outbound note specifies a coated finish (e.g. `RALY22778SD`) that does not exist directly in stock, the engine resolves to the source profile stock in the project matching the extrusion code and length, deducting the bars directly without creating a phantom duplicate.
- **Invariant [Pure-Original-Catalog-36]:** The project inventory consists strictly of the **36 legitimate catalog items** (33 with positive stock totaling **2,381 BAR** and **13,037 LM**, plus 3 legitimate catalog items with 0 balance).
- **Invariant [Phantom Elimination]:** `isPhantomDuplicate()` deterministically detects and eliminates all 15 phantom records spawned by `SO-00199` / `Sotalux` / `RALY22778SD` across `stock`, `deletedStock`, and `items`.
- **Invariant [Safe Zero-Stock Cleanup]:** `cleanupZeroStockItems` is hardened so it will NEVER purge legitimate catalog items; it only removes verified phantom duplicate records.

---

## 3. Targeted Code Surface (Modified Files & Symbols)
- `backend/src/services/warehouseStore.js`:
  - `isPhantomDuplicate(data, docId)`: Deterministic discriminator for outbound phantom records.
  - `getProjectStock(projectId)`: Reconciles active stock + legitimate zero-balance originals from `deletedStock` and `items`, restoring the exact count to **36 SKUs** and **2,381 BAR / 13,037 LM**.
  - `cleanupZeroStockItems()`: Protected from deleting legitimate zero-balance catalog originals.
  - `processInboundInvoice()`: Strict inbound-only creation lock; resolves outbound lines to existing warehouse profile records by code and length.
  - `processManualStockMovement()`: Strict inbound-only creation lock; resolves outbound lines to existing warehouse profile records.
- `frontend/src/pages/Warehouse.jsx`:
  - `loadStock()`: Enhanced phantom duplicate filtering preserving all 36 genuine items.
- `frontend/tests/warehouseCoating.test.mjs`:
  - Added unit regression test for deterministic 36-item reconciliation and total invariant preservation.
- `frontend/package.json`: Bumped version to `2.27.77`.

---

## 4. Verification Evidence & Quality Assurance
- **Frontend Unit Tests:** `node --test frontend/tests/warehouseCoating.test.mjs` -> Passed (7/7 tests).
- **Backend Test Suite:** `npm --prefix backend test -- --runInBand` -> Passed (5/5 suites, 75/75 tests).
- **Production Build:** `npm --prefix frontend run build` -> Clean build in 4.09s, zero errors.
- **Deployments:**
  - Firebase Hosting live at `https://fawterx.web.app` (Release finalized and live).
  - Git commit & push to `main` for Render auto-deploy.
