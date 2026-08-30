# Release Log — v2.27.23

**Date:** 2026-08-30  
**Type:** Critical Bug Fix — ETA Digital Signature Enforcement

---

## Problem

ETA was rejecting invoices with the following error:

```json
{
  "message": "Profile is configured to submit digitally signed documents only",
  "target": "documentTypeVersion"
}
```

**Root Cause:**  
The `/api/eta/drafts/:draftId/submit` endpoint was automatically injecting a **mock/fake signature** (`MOCK_SIGNATURE_BYPASS_FOR_TESTING_xxx`) into every draft document that lacked a real signature before submitting it to ETA. ETA's production profile requires a genuine **CMS/PKCS#7 digital signature** produced by a real USB Token — any other value is rejected outright.

---

## Fix

### `backend/src/routes/eta.js`
- **Removed** the `Auto-inject mock signature if missing` block from the `/drafts/:draftId/submit` endpoint.
- **Added** a strict signature validation gate that checks for:
  1. Missing `signatures` array
  2. Empty `signatures` array  
  3. Values that start with `MOCK_` (fake/bypass signatures)
- If any unsigned document is detected, returns `HTTP 400` with `requiresLocalSigning: true` and a clear Arabic message directing the user to use the **"Sign & Submit"** button in DraftDetails.

### `backend/src/services/etaSubmit.js`
- **Strengthened** the signature check to also block `MOCK_` prefixed signatures at the service layer.
- **Removed** the `TESTING_MODE` bypass that allowed unsigned documents to reach ETA in testing mode.
- Error message is now descriptive and explains the exact ETA rejection reason.

---

## Impact

- ✅ ETA will no longer receive unsigned/mock-signed invoices.
- ✅ Users are now clearly directed to sign via USB Token through DraftDetails.
- ✅ The `/eta/submit` direct route (used after local signing) is unaffected.
- ✅ Dry-run validation mode is unaffected.

---

## Files Changed

- `backend/src/routes/eta.js`
- `backend/src/services/etaSubmit.js`
- `frontend/package.json` (version bump to 2.27.23)
