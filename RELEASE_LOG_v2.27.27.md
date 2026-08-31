# Release Log — v2.27.27

**Date:** 2026-08-31  
**Type:** Bug Fix & Pipeline Parity — Excel Mapping Complete Alignment with Smart Upload

---

## Problem

Submitting invoices via **Excel Column Mapping** (`handleConfirmMapping`) was failing with ETA rejection:
```json
{
  "message": "Profile is configured to submit digitally signed documents only",
  "target": "documentTypeVersion"
}
```
while **Smart AI / PDF Upload** succeeded.

### Root Cause:
1. **Disparity in Customer Matching & Payload Passing:** Smart Upload was executing `applySavedCustomerMatches` to attach validated customer registry data and passing `finalDocs` directly to the preview and signer. Excel Mapping was skipping customer matching and prematurely running `cleanObject` which altered array structures.
2. **Schema Version Extraction:** `excelParser.js` was parsing any row containing "version" and injecting non-standard versions into `documentTypeVersion`, which caused ETA to treat the invoice as an unsigned/legacy profile submission.

---

## Fixes

1. **`frontend/src/pages/Home.jsx` (`handleConfirmMapping`):**
   - Added automatic `applySavedCustomerMatches(docs, customerList)` to Excel Mapping flow, identical to Smart Upload.
   - Removed destructive pre-cleaning and passed `finalDocs` directly to state and dry-run validation.

2. **`backend/src/utils/etaMapper.js` & `backend/src/utils/excelParser.js`:**
   - Enforced `documentTypeVersion: "1.0"` strictly across all mapper outputs to prevent legacy version rejections by ETA.

3. **`frontend/src/utils/signEtaDocuments.js`:**
   - Guaranteed `documentTypeVersion: "1.0"` and `documentType: "I"` on every signed document object prior to canonicalization and hash calculation.

---

## Impact

- ✅ Full behavioral parity between Excel Mapping and Smart Upload.
- ✅ All Excel-mapped invoices receive proper customer data, valid v1.0 document structure, and genuine CAdES-BES digital signature.
