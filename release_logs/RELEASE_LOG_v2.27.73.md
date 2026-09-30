# FawterX Release Log - v2.27.73

**Release Date:** 2026-09-30  
**Deployment Target:** Firebase Hosting (`https://fawterx.web.app`) & Render Backend Sync  
**Domain / Scope:** Warehouse / Stock Fetching / Read-Only Transaction Invariant  

---

## 1. Problem Statement & Root Cause
- **Trigger / User Feedback:** When opening the Warehouse page for `CANEX_WH`, the user encountered a critical 500 error toast: `"تعذر تحميل الأرصدة: القيم الحالية غير متاحة: A read operation attempted to change warehouse data."`, and stock displayed as empty (0 items).
- **Root Cause:** In v2.27.72, `getProjectStock(projectId)` was modified to attempt an asynchronous batch delete (`db.batch().delete(...)`) for any zero-balance documents detected. However, `getProjectStock` is explicitly registered in `readServices` with `{ readOnly: true }` wrapped by `projectOperation` in `warehousePersistence.js`. When `getProjectStock` queued batch write operations, `warehousePersistence.js` line 84 strictly enforced the read-only transaction boundary:
  ```javascript
  if (readOnly && writes.length) throw problem('A read operation attempted to change warehouse data.', 500);
  ```
  This immediately aborted the transaction and threw HTTP 500.

---

## 2. Established Invariants & Business Rulings
- **Invariant [Warehouse-ReadOnly-Purity]:** All functions declared in `readServices` (including `getProjectStock`) MUST be 100% idempotent and strictly read-only. They must NEVER call `db.batch()`, `.set()`, `.delete()`, or `.update()`.
- **Zero-Stock Elimination Guarantee:** Zero-stock items are completely filtered out in-memory during `getProjectStock` query processing (`quantityBar > 0 || quantityLm > 0`), ensuring they never reach the frontend or display in inventory counts. Permanent physical deletions from Firestore remain strictly confined to write operations (`processInboundInvoice`, `processManualStockMovement`, and `cleanupZeroStockItems`).

---

## 3. Targeted Code Surface (Modified Files & Symbols)
- `backend/src/services/warehouseStore.js`:
  - `getProjectStock(projectId)`: Removed `zeroDocs` async batch deletion block. Enforced clean, pure filtering returning only items with positive balance (`quantityBar > 0 || quantityLm > 0`).
- `frontend/package.json`: Bumped version to `2.27.73`.

---

## 4. Verification Evidence & Quality Assurance
- **Frontend Unit Tests:** `node --test frontend/tests/warehouseCoating.test.mjs` -> Passed (6/6 tests).
- **Backend Test Suite:** `npm --prefix backend test -- --runInBand` -> Passed (5/5 suites, 75/75 tests).
- **Production Build:** `npm --prefix frontend run build` -> 0 errors (4.12s).
- **Deployments:**
  - Firebase Hosting deployed live to https://fawterx.web.app
  - Committed and pushed to GitHub `main` branch.

---

## 5. Agent Quick-Context (Compaction Recovery)
- **Active State:** `getProjectStock` is verified pure read-only. Ghost zero-stock records do not appear in API responses.
- **Boundaries:** Physical batch deletion must only be initiated from write services.
