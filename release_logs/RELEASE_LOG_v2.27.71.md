# FawterX Release Log - v2.27.71

**Release Date:** 2026-09-29  
**Deployment Target:** Firebase Hosting (`https://fawterx.web.app`) & Render Backend Sync

---

## 1. Overview & Problem Statement
- **Ghost Zero-Balance Duplicate Stock Items:** After dispatching items from the Delmar coating storage (e.g. Sales Order `SO-00199`), 15 duplicate stock items unexpectedly appeared in the main warehouse inventory table with `0 BAR` balance.
- **Root Cause Analysis:**
  - In `backend/src/services/warehouseStore.js` (`processInboundInvoice`), outbound delivery invoices carry line items with the target finished painted color (e.g., `finish: "RALY22778SD"` or `"ANODIZED"`).
  - Because these profiles were 100% supplied from Delmar's coating pool (`delmarCovered: true`), the warehouse deduction factor was zero (`factorBar = 0`).
  - However, the service previously executed `batch.set(stockRef, { ... quantityBar: increment(factorBar) }, { merge: true })` unconditionally on every invoice line item.
  - In Firestore, executing `.set(..., { merge: true })` on a non-existent document path (`stock/CANEX-346980-RALY22778SD-5800`) creates a brand-new document with `quantityBar = 0`.
  - This spawned 15 zero-balance duplicate rows in the stock snapshot alongside the original raw aluminum inventory.

---

## 2. Changes & Key Implementations

### A. Outbound Phantom Stock Prevention (`warehouseStore.js`)
- **Deduction Guard:** Modified `processInboundInvoice` around line 884 to ensure `stockRef`, `items`, and `deletedStock` mutations only occur when:
  `if (!isOutbound || actualDeductBar > 0)`
- **Zero-Deduction Delmar Protection:** When an outbound delivery note is fulfilled from Delmar (`actualDeductBar === 0`), the transaction movement is recorded in `movements` for historical traceability, but the main warehouse `stock` snapshot is left completely untouched. No ghost records or zero-balance documents are ever created.

### B. One-Click Zero-Stock Cleanup Tool (`warehouseStore.js`, `warehouse.js`, `warehouseApi.js`)
- **Backend Service (`cleanupZeroStockItems`):**
  - Scans `collection("stock")` for items where `quantityBar <= 0` and `quantityLm <= 0`.
  - Automatically captures an auto restore point: `[تلقائي] قبل تنظيف وحذف ${count} صنف برصيد صفر`.
  - Atomically deletes them from `stock` and registers them into `deletedStock` with `reason: "zero_stock_cleanup"` to prevent accidental resurrection.
  - Audits the operation under `CLEANUP_ZERO_STOCK`.
  - Exposed via `POST /api/warehouse/projects/:projectId/stock/cleanup-zero-stock`.
- **Frontend Service & API:** Added `cleanupZeroStock(projectId)` in `warehouseApi.js`.

### C. Warehouse Inventory UI Enhancements (`Warehouse.jsx`)
- **One-Click Cleanup Action Button:**
  - Added a prominent amber toolbar button: `🧹 تنظيف الأصناف الصفرية (${count})` that only appears when zero-balance items exist in the project inventory.
  - Features confirmation prompting, auto restore point logging, and real-time inventory refresh.
- **Fast Filter Toggle (`إخفاء الأرصدة الصفرية (0)`):**
  - Added a responsive checkbox next to the stock search input.
  - When checked, instantly hides all items with 0 bars from the table and total count, giving users immediate clean inventory visibility without having to delete records.

---

## 3. Verification & Quality Assurance
- **Unit Tests:** `node --test frontend/tests/warehouseCoating.test.mjs` passed cleanly (6/6 tests, including new zero-stock detection and filtering tests).
- **Backend Tests:** `npm --prefix backend test -- --runInBand` passed completely (5/5 suites, 75/75 tests).
- **Frontend Production Build:** `npm --prefix frontend run build` compiled with 0 errors in 3.83s.
- **Deployment:** Successfully deployed to Firebase Hosting (`https://fawterx.web.app`) and pushed to GitHub for Render backend auto-deploy.
