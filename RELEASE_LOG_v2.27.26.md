# Release Log — v2.27.26

**Date:** 2026-08-31  
**Type:** Architecture & Reliability Enhancement — Universal Digital Signing Pipeline

---

## Overview

Unified frontend digital signing across all submission surfaces (`BatchWorkflow`, `DraftDetails`, `PreviewStep`, `Home`) to ensure 100% consistent date-normalization, CAdES-BES PKCS#7 token canonicalization, and strict pre-dispatch signature validation.

---

## Key Changes

### 1. `frontend/src/components/BatchWorkflow.jsx`
- Replaced fragmented ad-hoc token signing loop with centralized `signEtaDocuments` helper.
- Applied automatic `normalizeIssueDate` and `assertSignedBeforeLiveSubmit` verification.
- Ensured batch documents are fully signed and validated prior to dispatching to the live ETA endpoint.

### 2. `frontend/src/pages/DraftDetails.jsx`
- Refactored `handleTriggerSubmit` to utilize the unified `signEtaDocuments` pipeline.
- Cleaned up redundant serialization and object sanitization methods.
- Guaranteed that saved drafts always acquire valid USB token digital signatures when submitted from the draft details view.

### 3. Version Bump & Build Verification
- Bumped frontend package version to `v2.27.26`.
- Verified production build cleanliness with Vite (`npm run build`).

---

## Files Changed

- `frontend/src/components/BatchWorkflow.jsx`
- `frontend/src/pages/DraftDetails.jsx`
- `frontend/package.json` (Bumped to `2.27.26`)
- `RELEASE_LOG_v2.27.26.md` (Created)
