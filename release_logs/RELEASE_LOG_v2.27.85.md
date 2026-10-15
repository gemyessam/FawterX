# FawterX Release Log - v2.27.85

**Release Date:** 2026-10-15  
**Deployment Target:** Firebase Hosting (`https://fawterx.web.app`) & GitHub / Render Backend Sync  
**Domain / Scope:** Natural Numeric Invoice Ordering (1, 2, ..., 10) & Chronological Timestamp Staggering (3s Gap) Across Batch and ETA Submissions

## 1. Problem Statement & Root Cause
- **Out-of-Order Submissions:** When uploading batches of invoices, invoices could be listed or sent out of order (such as #10 preceding #1 or #2).
- **Underlying Root Causes:**
  1. Standard lexicographical string sorting (`"1"`, `"10"`, `"2"`) or random file input order from the browser caused invoice 10 to precede invoice 2 or 1.
  2. Batch documents had no deterministic natural numeric sort applied across UI state, file upload queues, or payload generation.
  3. All batch invoices received identical `dateTimeIssued` timestamps, allowing the ETA portal's listing algorithms to display them arbitrarily or in reversed reception sequence.

## 2. Established Invariants & Business Rulings
- **Natural Numeric Collation (`localeCompare` with `numeric: true`):** All invoices are strictly sorted in natural numeric order (`1, 2, ..., 9, 10, 20...`) by `internalID` (falling back to filename) at every lifecycle stage:
  - File selection queue in `UploadStep.jsx`.
  - Batch upload endpoint in `backend/src/routes/excel.js`.
  - Batch generation and sidebar workspace in `BatchWorkflow.jsx`.
  - Multi-invoice mapping in `backend/src/utils/etaMapper.js`.
  - Pre-signing payload collation in `frontend/src/pages/Home.jsx`.
  - Final submission payload sorting in `backend/src/services/etaSubmit.js`.
- **Chronological Timestamp Staggering (`sortAndStaggerDocuments`):**
  - Successive invoices in a batch receive `dateTimeIssued` timestamps incremented by a 3-second gap in strict order of their invoice numbers.
  - Base timestamps are calculated safely in the recent past (`Date.now() - (count * 3000ms)`), mathematically guaranteeing that no timestamp ever exceeds current server time (preventing ETA future-date rejections).
- **Strict Testing Contract:** Automated browser testing tools remain strictly prohibited. All validation is proven via CLI tests and production compilation.

## 3. Targeted Code Surface (Modified & New Files)
- `frontend/package.json`: Bumped version to `2.27.85`.
- `frontend/src/utils/uploadTime.js`: Implemented and exported `sortAndStaggerDocuments(documents, stepSeconds = 3)`.
- `frontend/src/components/UploadStep.jsx`: Applied natural sorting to uploaded file queue.
- `frontend/src/components/BatchWorkflow.jsx`: Applied natural sorting and 3-second chronological staggering upon document generation and immediately before digital signing.
- `frontend/src/pages/Home.jsx`: Enforced `sortAndStaggerDocuments` for multi-invoice Excel generation and single/batch ETA submission.
- `backend/src/routes/excel.js`: Naturally sorted `req.files` and returned `results` in `/api/excel/upload-batch`.
- `backend/src/utils/etaMapper.js`: Added natural numeric sorting and 3-second timestamp staggering for multi-invoice generation.
- `backend/src/services/etaSubmit.js`: Applied defensive natural numeric sorting to `docsArray` before submitting payload to ETA.
- `frontend/tests/batch-order.test.mjs`: Added comprehensive unit tests for natural ordering, 3-second staggering, and future-clock skew containment.

## 4. Verification Evidence & Quality Assurance
- **Frontend Unit Tests:** `node --test frontend/tests/*.test.mjs` -> Passed (32/32 passed in 1.34s).
- **Backend Test Suite:** `npm --prefix backend test -- --runInBand` -> Passed (123/123 passed in 1.83s).
- **Production Build:** `npm --prefix frontend run build` -> Passed with zero errors (`dist/` generated cleanly in 5.37s).
- **Firebase Hosting Deployment:** Deployed to `fawterx.web.app`.
- **GitHub / Render Synchronization:** Pushed to `origin main` to trigger automatic backend deployment.

## 5. Agent Quick-Context (Compaction Recovery)
- **Active State:** v2.27.85 is live on Firebase Hosting and synchronized with GitHub main for Render deployment.
- **User Experience:** Batch submissions now strictly preserve natural invoice ordering (1, 2, ..., 10) on both FawterX and ETA portal with clean 3-second issue time separation.
