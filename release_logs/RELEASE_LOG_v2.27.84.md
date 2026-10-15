# FawterX Release Log - v2.27.84

**Release Date:** 2026-10-15  
**Deployment Target:** Firebase Hosting (`https://fawterx.web.app`) & GitHub / Render Backend Sync  
**Domain / Scope:** Auto-Signer Launch on Submit, Batch Completion Workspace, Unified Submission Navigation, and Resilient Draft Auto-Save on Error

## 1. Problem Statement & Root Cause
- **Redundant User Action for Signer:** Users had to manually click a separate "فتح أداة التوقيع" button before being able to click "إرسال الكل لـ ETA". If clicked directly, short timeouts could cause connection issues with the desktop local signer.
- **Workflow Stalling in Batch Mode:** In `BatchWorkflow.jsx`, after digital signing and ETA submission succeeded, the UI remained frozen on the editing screen (`step === 3`), showing only a fleeting toast notification without advancing to a persistent confirmation/summary workspace.
- **Lost Progress on Failures:** If validation, signing, or ETA submission failed at any stage (batch, Excel upload, or draft inspection), the documents were not automatically persisted to the draft store, risking data loss.
- **Draft Navigation Friction:** When inspecting drafts in `DraftDetails.jsx`, users lacked quick navigation links to return to the Home dashboard or view other saved drafts after submission.

## 2. Established Invariants & Business Rulings
- **One-Click Sign & Submit:** Clicking "توقيع وإرسال" automatically pings, wakes, and waits for `fawterx-signer://open` up to 10 seconds with automatic protocol retry before dispatching payloads. Manual tool opening remains available purely as an optional secondary action.
- **Batch Confirmation Workspace (`step === 4`):** Submitting batches immediately transitions the user into a rich confirmation view featuring:
  - Metric counters (Total, Accepted, Value in EGP).
  - Prominent Submission UUID with one-click copy.
  - Live portal verification polling (`getETAStatus(uuid)`).
  - Clear navigation controls: "رفع دفعة جديدة", "سجل المسودات", and "الرئيسية".
- **Zero Data Loss Invariant (Auto-Draft on Error):** Any submission failure across backend (`/api/eta/submit`, dryRun or live) and frontend (`BatchWorkflow`, `Home`, `DraftDetails`) immediately creates or updates a draft in Firestore with complete documents, calculation totals, and explicit error reasons.
- **Strict Testing Contract:** Automated browser testing tools remain strictly prohibited. All validation is proven via CLI tests and production compilation.

## 3. Targeted Code Surface (Modified Files)
- `frontend/package.json`: Bumped version to `2.27.84`.
- `backend/src/routes/eta.js`: Auto-saves drafts on pre-validation errors, missing signatures, ETA rejections, or network errors, and returns `draftId`.
- `backend/src/services/draftStore.js`: Hardened `saveDraft` to store sanitized invoice documents and full line items without dropping attributes on Firestore undefined fields.
- `frontend/src/services/api.js`: Enhanced `ensureLocalSignerActive` with 20 retries (10s) and automatic re-triggering of protocol handler. Exported `saveDraftOnFailure`.
- `frontend/src/components/BatchWorkflow.jsx`: Added confirmation workspace (`step === 4`), live portal verification, batch reset, and auto-draft error capture.
- `frontend/src/pages/Home.jsx`: Integrated `saveDraftOnFailure` on ETA trigger, with links to `/drafts` and confirmation banner.
- `frontend/src/pages/DraftDetails.jsx`: Added Home and Drafts hub buttons, and replaced the submit button with a verified status indicator when already accepted.

## 4. Verification Evidence & Quality Assurance
- **Frontend Unit Tests:** `node --test frontend/tests/*.test.mjs` -> Passed (29/29 passed in 1.46s).
- **Backend Test Suite:** `npm --prefix backend test -- --runInBand` -> Passed (123/123 passed in 1.64s).
- **Production Build:** `npm --prefix frontend run build` -> Passed with zero errors (`dist/` generated cleanly in 5.28s).
- **Firebase Hosting Deployment:** Deployed to `fawterx.web.app`.
- **GitHub / Render Synchronization:** Pushed to `origin main` to trigger automatic backend deployment.

## 5. Agent Quick-Context (Compaction Recovery)
- **Active State:** v2.27.84 is live on Firebase Hosting and synchronized with GitHub main for Render deployment.
- **User Experience:** Seamless one-click sign & submit across batch and individual workflows with dedicated confirmation views and draft safety nets.
