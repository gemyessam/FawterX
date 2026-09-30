# FawterX Release Log - v2.27.76

**Release Date:** 2026-09-30  
**Deployment Target:** Firebase Hosting (`https://fawterx.web.app`) & Render Backend Sync  
**Domain / Scope:** Warehouse / Phantom Duplicate Elimination / 36 Pure SKUs  

---

## 1. Problem Statement & Root Cause
- **Trigger / User Feedback:** The user demanded to know why rows 37 to 51 (the 15 duplicated items with `SO-00199` and `Sotalux`) were still showing in the inventory table.
- **Root Cause:**
  - When outbound delivery note `SD-000000594` was processed on 2026/09/29, it spawned 15 phantom records in Firestore `stock` collection with painted finish (`RALY22778SD` / `ANODIZED` / `MF`) and `quantityBar: 0` for order `SO-00199` and customer `Sotalux`.
  - When returning all records, these 15 phantom records appeared as items 37 to 51, inflating the count from 36 to 51.

---

## 2. Established Invariants & Business Rulings
- **Invariant [Pure-Original-Catalog-36]:** The project catalog consists strictly of the **36 original items** entered via inbound delivery notes. Phantom zero-balance records spawned by outbound delivery notes (specifically matching `lastSalesOrder: SO-00199` / `lastCustomerRef: Sotalux` / `lastMovementType: outbound` with 0 balance) must NEVER be included in `getProjectStock` or `Warehouse.jsx`.
- **Automatic Elimination:** Both the backend query and the frontend state filter out these 15 phantom outbound duplicate items. The active table and SKU counter now strictly display the **36 original items**.

---

## 3. Targeted Code Surface (Modified Files & Symbols)
- `backend/src/services/warehouseStore.js`:
  - `getProjectStock(projectId)`: Excludes phantom outbound duplicates (`isZero && isPhantomOutbound`).
- `frontend/src/pages/Warehouse.jsx`:
  - `loadStock()`: Direct exclusion of phantom outbound duplicate records so only the 36 genuine items load.
- `frontend/package.json`: Bumped version to `2.27.76`.

---

## 4. Verification Evidence & Quality Assurance
- **Frontend Unit Tests:** `node --test frontend/tests/warehouseCoating.test.mjs` -> Passed (6/6 tests).
- **Backend Test Suite:** `npm --prefix backend test -- --runInBand` -> Passed (5/5 suites, 75/75 tests).
- **Production Build:** `npm --prefix frontend run build` -> 0 errors (4.15s).
- **Deployments:**
  - Firebase Hosting live at https://fawterx.web.app
  - Committed and pushed to GitHub `main`.
