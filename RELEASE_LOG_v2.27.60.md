# Release Log - FawterX v2.27.60

**Release Date:** September 7, 2026  
**Type:** Security Hardening & Access Control Enforcement (FX-001 / Phase 1)  
**Component:** Backend Warehouse Routes (`warehouse.js`), Warehouse Store (`warehouseStore.js`), Automated Regression Tests

---

## Summary of Changes

### 1. Warehouse Permission Bypass Fixes & Role Enforcement
- **Cost Reconciliation Guard:** Secured `POST /projects/:projectId/reconcile-delmar-and-costs` with strict authorization checks (`403 Forbidden` for `warehouse_viewer` or users lacking `canEdit` permission), ensuring view-only users cannot trigger cost recalculations or close Delmar dispatches.
- **Outbound Invoice Dispatch Restriction:** Hardened `POST /projects/:projectId/invoices/process` to verify `canDispatch` when processing `outbound` sales invoices. Users with upload permission but without dispatch authority are rejected with `403 Forbidden`.
- **Movement Type Normalization:** Standardized `movementType` across invoice processing and manual movements with whitespace trimming and case insensitivity, preventing permission bypasses via unformatted input (e.g. `" Outbound "`).
- **Project Alias & ACL Resolution:** Unified project resolution across `requireWarehouse` and `requireAdmin` middlewares using the exported `resolveProject` helper, ensuring ACL access checks accurately evaluate both raw aliases (e.g. `default_canex`) and canonical Firestore document IDs.

### 2. Automated Regression Test Suite
- Added `backend/tests/warehousePermissions.test.js` featuring 25 isolated regression tests covering permission denials, alias resolution, admin routing, and service invocation safety with isolated Firebase SDK mocks.

---

## Verification & Deployment
- **Automated Tests:** 31 tests passed across 3 test suites (`npm --prefix backend test -- --runInBand`).
- **Codex Peer Review:** Formally reviewed and verified via Codex with `REVIEW_PASSED`.
- **Frontend Build:** Successfully built production bundle in 3.81s (`npm --prefix frontend run build`).
- **Firebase Hosting:** Deployed live to `https://fawterx.web.app`.
- **Git Push:** Committed and pushed to `origin main` for automated Render production sync.
