# FawterX Release Log - v2.27.75

**Release Date:** 2026-09-30  
**Deployment Target:** Firebase Hosting (`https://fawterx.web.app`) & Render Backend Sync  
**Domain / Scope:** Warehouse / Inbound Purity / Outbound Stock Creation Lock  

---

## 1. Problem Statement & Root Cause
- **Trigger / User Feedback:** The user noticed 15 phantom duplicate items appearing in the warehouse table with 0 balance, Sales Order `SO-00199`, customer `Sotalux`, and painted finish (e.g. `RALY22778SD` and `ANODIZED`). The user questioned: "Why on earth are these items recorded when they never entered via an inbound delivery note (إذن توريد)? And on top of that, they are duplicates of existing raw profiles!"
- **Root Cause Analysis:**
  - In a warehouse system, **ONLY an Inbound Delivery Note (إذن توريد)** introduces inventory and creates catalog items in `stock` or `items`.
  - When outbound delivery note `SD-000000594` was processed, the invoice lines carried painted finish codes (e.g. `RALY22778SD`).
  - `processInboundInvoice` and `processManualStockMovement` previously called `batch.set(stockRef, ..., { merge: true })` and `batch.set(itemRef, ..., { merge: true })` unconditionally.
  - In Firestore, executing `.set(..., { merge: true })` on a non-existent document path (`stock/CANEX-346980-RALY22778SD-5800`) creates a brand-new document!
  - Consequently, 15 phantom documents with 0 balance and the painted finish were spawned in `stock` and `items`, duplicating the original raw profiles.

---

## 2. Established Invariants & Business Rulings
- **Invariant [Inbound-Only-Creation]:** Under NO circumstances may an outbound invoice or outbound movement create a document in `stock` or `items`.
- **Outbound Guard Implementation:**
  - In `processInboundInvoice` and `processManualStockMovement`:
    - `batch.set()` on `items` and `stock` is strictly locked to `!isOutbound`.
    - If `isOutbound` is true, the service ONLY updates existing stock records via `batch.update()` if `actualDeductBar > 0` and `stockDoc.exists`.
    - If an outbound line is covered from Delmar or does not exist in raw warehouse stock, it records the movement for audit and dispatch fulfillment, but **NEVER touches or creates warehouse stock records**.

---

## 3. Targeted Code Surface (Modified Files & Symbols)
- `backend/src/services/warehouseStore.js`:
  - `processInboundInvoice()`: Strict lock ensuring `items` and `stock` creation only occurs on inbound. Outbound uses `batch.update()` on existing docs.
  - `processManualStockMovement()`: Same strict inbound-only creation lock.
- `frontend/package.json`: Bumped version to `2.27.75`.

---

## 4. Verification Evidence & Quality Assurance
- **Frontend Unit Tests:** `node --test frontend/tests/warehouseCoating.test.mjs` -> Passed (6/6 tests).
- **Backend Test Suite:** `npm --prefix backend test -- --runInBand` -> Passed (5/5 suites, 75/75 tests).
- **Production Build:** `npm --prefix frontend run build` -> 0 errors (4.32s).
- **Deployments:**
  - Firebase Hosting live at https://fawterx.web.app
  - Committed and pushed to GitHub `main`.
