# FawterX Release Log - v2.27.82

**Release Date:** 2026-10-15  
**Deployment Target:** Firebase Hosting (`https://fawterx.web.app`) & GitHub / Render Backend Sync  
**Domain / Scope:** Performance Optimization, Drafts UX Navigation, Log Sanitization & Security Hardening  

## 1. Problem Statement & Root Cause
- **Bundle Bloat:** The frontend bundle was compiled into a single massive 1.89 MB JavaScript chunk because large components (`Warehouse.jsx` 384 KB, `ReleaseNotesModal.jsx` 118 KB, `AdminPanel.jsx`, and heavy libraries `xlsx`/`exceljs`) were statically imported at the root of `App.jsx`.
- **Drafts UX Isolation:** Saved drafts in `Drafts.jsx` only displayed a Delete button, omitting any navigation to the existing `DraftDetails.jsx` page (`/drafts/:id`), preventing users from reviewing, signing, or editing recovery drafts.
- **Log Leakage of Financial Data:** Full customer invoice JSON payloads and raw OCR extracted lines were logged to `console.log` on every submit and Schuco PDF parse in `eta.js`, `etaMapper.js`, and `smartParser.js`.
- **Server Disk File Accumulation:** Uploaded Excel and PDF files in `backend/src/routes/excel.js` were only removed upon catch exceptions, leaving processed files permanently on server disk during successful operations.
- **Overly Broad Dev Mock Auth:** `backend/src/middleware/auth.js` automatically created a mock user for any unauthenticated request in non-production environments without an explicit opt-in environment flag.

## 2. Established Invariants & Business Rulings
- Heavy pages and modal views (`Warehouse`, `AdminPanel`, `Drafts`, `DraftDetails`, and `ReleaseNotesModal`) must be dynamically loaded on demand via `React.lazy` and `<Suspense>`, preserving snappy initial page loads.
- Application routes must be wrapped with a top-level `<ErrorBoundary>` to fail gracefully rather than crashing to a blank white screen.
- Server logs must never dump raw customer invoice contents, tax documents, or OCR text; logs are strictly restricted to technical identifiers and counts.
- Uploaded temporary files must be cleaned up immediately in a `finally` block post-parsing.
- Dev mock authentication requires an explicit environment flag (`ALLOW_DEV_MOCK_AUTH === "true"` or `NODE_ENV === "test"`).
- Two-factor authentication (2FA) enforcement remains temporarily paused per explicit user directive.

## 3. Targeted Code Surface (Modified Files & Symbols)
- `frontend/package.json`: Bumped application version to `2.27.82`.
- `frontend/vite.config.js`: Added `manualChunks` to split `vendor-excel` and `vendor-firebase` from the main bundle.
- `frontend/src/App.jsx`: Lazy-loaded heavy pages and modals, wrapped routes with `ErrorBoundary` and `Suspense`.
- `frontend/src/pages/Drafts.jsx`: Added View/Edit link on `internalID` and an action button navigating to `/drafts/:id`.
- `frontend/src/services/api.js`: Enabled local network IP detection (`192.168.x.x`, `10.x.x.x`) for mobile testing and removed dead bypass token.
- `backend/src/routes/eta.js`: Sanitized ETA submit and draft submit logs.
- `backend/src/routes/excel.js`: Enforced immediate file unlink in `finally` blocks for `/upload` and `/upload-batch`.
- `backend/src/utils/etaMapper.js`: Removed verbose input/output invoice document console logging.
- `backend/src/utils/smartParser.js`: Removed raw OCR lines and verbose debug footer strategy dumps.
- `backend/src/middleware/auth.js`: Guarded mock dev authentication behind `ALLOW_DEV_MOCK_AUTH === "true"`.
- `backend/src/middleware/security.js`: Added local LAN origins and exposed headers `X-FawterX-Commit` and `X-FawterX-Stock-Deletion-Contract`.

## 4. Verification Evidence & Quality Assurance
- **Frontend Unit Tests:** `node --test frontend/tests/*.test.mjs` -> Passed (11/11).
- **Backend Test Suite:** `npm --prefix backend test -- --runInBand` -> Passed (123/123 in 2.2s).
- **Production Build:** `npm --prefix frontend run build` -> Passed with zero errors. Initial bundle reduced from 1,892 KB to 423 KB (77% size decrease).
- **Git Tree Check:** Clean scoped diff with no unrelated edits.

## 5. Agent Quick-Context (Compaction Recovery)
- **Active State:** v2.27.82 is deployed to Firebase Hosting and pushed to GitHub main for Render sync.
- **Known Invariants:** 2FA is paused for direct access per user request; stock provenance and deletion contracts remain at version 2.
