# FawterX Release Log - v2.27.80

**Release Date:** 2026-10-01
**Commit Hash:** See the Git commit containing this ledger.
**Deployment Target:** Firebase Hosting (`https://fawterx.web.app`) & Render Backend Sync
**Domain / Scope:** Warehouse stock provenance and read-only restore-point inspection

## 1. Problem Statement & Root Cause
- Stock GET and the frontend hid legitimate exhausted and negative stock using latest movement, finish, supplier, code and length heuristics. Cleanup could delete legitimate zero records using the same heuristics.
- Prior release claims of exactly 36 live SKUs are not verified. The supplied SD-000000594 PDF has 16 lines; attribution of 18 database artifacts requires historical data.

## 2. Established Invariants & Business Rulings
- Retain nonzero BAR/LM/KG balances, including negative and malformed balances, and unknown-origin zero stock.
- Exclude or clean up only exact-zero records with valid outbound evidence and affirmative outbound birth evidence; valid inbound provenance protects depleted stock.
- Respect all existing deletion tombstones. GET does not write, inject catalog entries, or restore missing stock.
- Do not infer birth from updatedAt, finish, supplier, item code, length or outbound-only history. Use exact recorded keys and active-generation evidence.

## 3. Targeted Code Surface (Modified Files & Symbols)
- `backend/src/services/warehouseStockProvenance.js`: shared balance/evidence classifier.
- `backend/src/services/warehouseStore.js`: stock GET and cleanup use shared classification and authoritative document IDs.
- `frontend/src/pages/Warehouse.jsx`: display backend rows without duplicate business filtering.
- `backend/scripts/inspect_canex_restore_point.js`: explicit read-only target, legacy/schema2 integrity validation, full SKU identities, no customer/financial output.
- Backend integrity/inspector tests and frontend coating tests: regression coverage and removal of synthetic duplicate classifier checks.
- Frontend package manifest and lockfile: version 2.27.80, no dependency changes.

## 4. Verification Evidence & Quality Assurance
- Frontend Unit Tests: `node --test frontend/tests/warehouseCoating.test.mjs` -> 6/6 passed.
- Backend Test Suite: `npm --prefix backend test -- --runInBand --silent` -> 114/114 passed in 6 suites.
- Independent Review: REVIEW_PASSED for the seven implementation files; 59 focused tests passed in 2 suites.
- Production Build: Vite build passed; existing large-bundle warning remains. Release-version build is performed before upload.
- Deployment status is reported from CLI results after release; this ledger does not assert deployment success in advance.

## 5. Agent Quick-Context (Compaction Recovery)
- Local code repair is verified; no fixed SKU count or guessed historical identities. User explicitly authorized Codex implementation for this task and subsequently requested upload after Antigravity quota exhaustion.
- Exact three original zero SKU keys and live 36/2381 BAR/13037 LM totals remain unverified. Credentialed read-only inspection of the pre-SD restore point and active state is required; no live data restoration was performed.
- No browser automation, real ETA submission or USB signing. No production Firestore writes during verification.
