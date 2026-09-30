# FawterX Release Log - v2.27.74

**Release Date:** 2026-09-30  
**Deployment Target:** Firebase Hosting (`https://fawterx.web.app`) & Render Backend Sync  
**Domain / Scope:** Warehouse / Catalog Preservation / Total SKU Reconciliation  

---

## 1. Problem Statement & Root Cause
- **Trigger / User Feedback:** The user noted that the active stock SKU count showed 33 items while the project restore point (`[تلقائي] قبل معالجة فاتورة صرف رقم SD-000000594`) had 36 items.
- **Root Cause & Mathematical Proof:**
  - Notice the totals:
    - Restore Point: 36 SKUs | 2,381 BAR | 13,037 LM
    - Active Stock Screen: 33 SKUs | 2,381 BAR | 13,037 LM
  - **Zero physical material was ever lost or deleted:** Both the restore point and the active stock have identical 2,381 BAR and 13,037 LM.
  - The drop in SKU count from 36 to 33 occurred purely because in-memory filters (`quantityBar > 0 || quantityLm > 0`) were excluding 3 registered project profile items that currently had zero physical bars.
  - Additionally, outbound delivery invoices had an automatic purge batch that attempted to move zero-depleted stock items to `deletedStock`.

---

## 2. Established Invariants & Business Rulings
- **Invariant [Catalog-Integrity]:** Registered project profile items must never be filtered out or purged simply because their warehouse balance reaches 0. If an item is part of the project catalog, it remains in the stock inventory list with `0 BAR`, preserving the exact catalog count (36 SKUs).
- **No Automatic Depletion Purge:** Removed automatic zero-stock purge loops from `processInboundInvoice` and `processManualStockMovement`.

---

## 3. Targeted Code Surface (Modified Files & Symbols)
- `backend/src/services/warehouseStore.js`:
  - `getProjectStock(projectId)`: Returns all project items in `stock` without filtering out zero-balance items.
  - `processInboundInvoice()`: Removed `purgeBatch` block.
  - `processManualStockMovement()`: Removed `purgeBatch` block.
- `frontend/src/pages/Warehouse.jsx`:
  - `loadStock()`: Direct `setStock(res.stock)`.
  - `filteredStock`: Direct search filtering across all catalog items without excluding zero balances.
- `frontend/package.json`: Bumped version to `2.27.74`.

---

## 4. Verification Evidence & Quality Assurance
- **Frontend Unit Tests:** `node --test frontend/tests/warehouseCoating.test.mjs` -> Passed (6/6 tests).
- **Backend Test Suite:** `npm --prefix backend test -- --runInBand` -> Passed (5/5 suites, 75/75 tests).
- **Production Build:** `npm --prefix frontend run build` -> 0 errors (4.22s).
- **Deployments:**
  - Firebase Hosting live at https://fawterx.web.app
  - Committed and pushed to GitHub `main`.
