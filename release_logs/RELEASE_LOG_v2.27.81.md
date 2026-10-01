# FawterX Release Log - v2.27.81

**Release Date:** 2026-10-01
**Commit Hash:** See the Git commit containing this ledger.
**Deployment Target:** Firebase Hosting (`https://fawterx.web.app`) & Render Backend Sync
**Domain / Scope:** Warehouse manual zero-stock deletion

## 1. Problem Statement & Root Cause
- User reports success toast followed by a returning zero-stock row. Existing UI announced success before a fresh server confirmation and allowed concurrent confirmation snapshots to overwrite each other.
- Locally reproduced an independent backend failure: deletion rewrote all linked movements inside one atomic transaction and exceeded its write budget with 500 movements. The exact live data cause remains unverified.

## 2. Established Invariants & Business Rulings
- Explicit manual deletion of exact-zero BAR/LM/KG stock is bounded and atomic: delete stock, preserve full backup in deletedStock, merge persistent exact-key history fence into items, and audit.
- Repeated deletion preserves original backup/fence. Nonzero deletion retains its previous behavior.
- Old, equal-cutoff and undated movements cannot restore deleted stock or reverse historical allocations. New inbound clears the tombstone but preserves the fence; subsequent movements remain usable.
- Success requires DELETE contract v2 and fresh stock GET contract v2 proving exact-key absence. Single and bulk mutations share a synchronous lock; failed bulk keys remain selected.

## 3. Targeted Code Surface (Modified Files & Symbols)
- `backend/src/services/warehouseStore.js`: bounded zero deletion; history and invoice rollback fence filtering.
- `backend/src/routes/warehouse.js`: no-store stock responses and read-contract version.
- `backend/index.js`: no-store public health diagnostic exposing contract version and optional Render Git revision only.
- `frontend/src/services/warehouseApi.js`: encoded deletion paths and cache-busting confirmation reads.
- `frontend/src/utils/warehouseDeletion.mjs`, `frontend/src/pages/Warehouse.jsx`: server-confirmed deletion and shared mutation lock.
- Backend and frontend regression tests; frontend version 2.27.81.

## 4. Verification Evidence & Quality Assurance
- **Frontend Unit Tests:** `node --test frontend/tests/*.test.mjs` -> Passed (11/11).
- **Backend Test Suite:** `npm --prefix backend test -- --runInBand --silent` -> Passed (123/123).
- **Production Build:** `npm --prefix frontend run build` -> Passed; existing bundle-size warning remains.
- **Deployments:** Pending release; verify Firebase deployment and Render revision independently before reporting completion.

## 5. Agent Quick-Context (Compaction Recovery)
- **Active State:** User authorized Codex implementation/release for this warehouse task after Antigravity quota exhaustion. Default role agreement still applies to other work.
- **Known Boundaries:** No production customer records changed by tests or this release. Live deletion still requires the user's authenticated action. Prior exact-36-SKU claim remains unverified; do not enforce a fixed count or broad code blacklist.
