# FawterX Release Log - v2.27.72

**Release Date:** 2026-09-30  
**Deployment Target:** Firebase Hosting (`https://fawterx.web.app`) & Render Backend Sync

---

## 1. Overview & Problem Statement
- **Zero Stock Items & Cluttered Manual Controls:** The user explicitly rejected manual cleanup buttons ("تنظيف وحذف الأصناف الصفرية") and visibility checkboxes ("إخفاء الأرصدة الصفرية") in the inventory UI. 
- **Requirement:** Zero-balance items must be permanently and automatically eliminated from the database without any user intervention, must never be added to the stock table, and the UI must remain completely clean and uncluttered.

---

## 2. Changes & Key Implementations

### A. Automatic Backend Zero-Stock Purge & Exclusion (`warehouseStore.js`)
- **`getProjectStock(projectId)` Invariant Enforcement:**
  - Strictly filters out any document where `quantityBar <= 0 && quantityLm <= 0`.
  - Automatically and asynchronously purges all zero-balance documents from `collection("stock")` into `collection("deletedStock")` with `reason: "auto_zero_stock_purge"`.
  - The API returns ONLY active inventory with positive balances (`quantityBar > 0 || quantityLm > 0`).
- **Outbound Depletion Purge (`processInboundInvoice` & `processManualStockMovement`):**
  - Following any outbound movement transaction, any stock record depleted to `<= 0` is automatically deleted from `stock` and cataloged in `deletedStock`.
  - Resurrection from `deletedStock` is strictly locked to inbound delivery notes (`!isOutbound`).

### B. UI De-cluttering & Automatic Filtering (`Warehouse.jsx`)
- **Removed Cluttered Manual Controls:**
  - Completely removed the `🧹 تنظيف وحذف الأصناف الصفرية` action button.
  - Completely removed the `إخفاء الأرصدة الصفرية (0)` checkbox from the search bar.
  - Removed all associated manual cleanup state variables and event handlers.
- **Frontend Active Stock Guarantee:**
  - `loadStock` and `filteredStock` enforce automatic positive-balance filtering: `item.quantityBar > 0 || item.quantityLm > 0`.
  - Total item count ("عدد الأصناف") automatically reflects genuine active profiles without phantom zero-balance records.

---

## 3. Verification & Quality Assurance
- **Frontend Unit Tests:** `node --test frontend/tests/warehouseCoating.test.mjs` passed cleanly (6/6 tests).
- **Backend Test Suite:** `npm --prefix backend test -- --runInBand` passed completely (5/5 suites, 75/75 tests).
- **Production Build:** `npm --prefix frontend run build` built successfully in 7.37s with 0 errors.
- **Deployment:** Successfully deployed to Firebase Hosting (`https://fawterx.web.app`) and pushed to GitHub for Render auto-deploy.
