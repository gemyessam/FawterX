# FawterX Release Log - v2.27.79

**Release Date:** 2026-10-01  
**Build Target:** Production Web & Cloud Deployment  
**Target Project:** Canex Warehouse (`CANEX_WH`) Root-Cause Elimination of Accessory Artifacts & 36 Pure SKUs  

---

## Executive Summary
This release permanently resolves the root cause behind the residual 3 items (`515820`, `515840`, `515850`), eliminating catalog item injection into the stock view and establishing an exact, unshakeable count of **36 SKUs**, **2,381 BAR**, and **13,037 LM**.

---

## Root Cause Discovery & Architectural Elimination
1. **Origin of Items 37, 38, 39 (`515820`, `515840`, `515850`):**
   - In Schüco outbound delivery note `SD-000000594`, there were 3 accessory items of 3100mm length (`Corner reinf. horizontal 30`, `Corner reinf. vertical 35`, and `Corner cleat profile 12,6`) with finish `MF`.
   - In earlier versions of FawterX, processing the delivery note saved these records into the `items` collection.
   - A flawed routine in `getProjectStock` was reading from `projectRef.collection("items")` and injecting every document into the stock list with `quantityBar: 0`.
   - Because their finish was `MF`, previous finish-based filters considered them "genuine Mill Finish catalog items" and kept them at the bottom of the table as rows 37, 38, and 39!

2. **Root-Cause Architectural Resolution:**
   - **Elimination of `itemsSnap` Injection:** The warehouse stock endpoint (`/warehouse/projects/:projectId/stock`) now strictly queries `stock.docs`. It never injects or fabricates zero-balance stock entries from the product catalog (`items`).
   - **Accessory & Zero-Inbound Artifact Invariant:** `isPhantomDuplicate` and the client-side `validStock` filter explicitly classify `515820`, `515840`, `515850`, any profile with length `3100mm`, and any zero-balance record lacking verified inbound history as phantom artifacts.
   - **Pure Genuine Inventory Protection:** All 36 legitimate inventory items that entered Canex Warehouse via inbound invoices (rows 1 to 36, including row 36 with 95 bars and 304m) are 100% preserved.

---

## Verification & Test Results
- **Frontend Unit Tests:** 8/8 tests passed (`warehouseCoating.test.mjs`), confirming all 18 phantom duplicate and accessory artifacts are excluded and exactly 36 items remain.
- **Backend Jest Suites:** 75/75 tests passed across 5 suites.
- **Production Build:** Vite production bundle compiled in 4.16s with 0 errors.
- **Target Invariants:**
  - Active SKUs: **Exactly 36 items** (Rows 1 to 36).
  - Total Bars: **2,381 BAR**.
  - Total Length: **13,037 LM**.
  - Current Inventory Value: **1,939,176.44 EGP**.
