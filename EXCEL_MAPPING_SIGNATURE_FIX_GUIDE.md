# FawterX - Excel Mapping Missing Digital Signature Fix Guide

Date: 2026-08-30  
Issue: ETA rejects invoices submitted through **Excel Mapping** with missing digital signature, while **PDF Smart Upload** and **Batch Upload** submit successfully.

## ETA Error

```json
{
  "internalId": "202303691",
  "error": {
    "message": "Validation Error",
    "details": [
      {
        "message": "Profile is configured to submit digitally signed documents only",
        "target": "documentTypeVersion"
      }
    ]
  }
}
```

## What This Means

ETA is saying:

> This issuer profile is configured to accept only digitally signed documents.

So the JSON sent from the Excel Mapping flow reached ETA **without a valid `signatures` array**.

This is not a tax-code or document-version problem. The error appears under `documentTypeVersion`, but the real meaning is:

```text
document.signatures is missing or invalid
```

## Current Code Evidence

### Working Flow: Home smart/PDF submit

File:

```text
frontend/src/pages/Home.jsx
```

Working function:

```js
handleTriggerETA()
```

This flow:

1. Calls `ensureLocalSignerActive()`.
2. Builds canonical string with `serializeToken(cleanedDoc)`.
3. Sends canonical string to local signer:

```js
fetch("http://localhost:8585/sign", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ canonicalString })
})
```

4. Adds:

```js
signatures: [{
  signatureType: "I",
  value: signData.signature
}]
```

5. Sends signed document:

```js
submitToETA(updatedDocs, false)
```

### Working Flow: Batch upload submit

File:

```text
frontend/src/components/BatchWorkflow.jsx
```

Working function:

```js
handleBatchSubmit()
```

This flow does the same correct local signing before live submission.

### Broken Flow: Excel Mapping

Files involved:

```text
frontend/src/pages/Home.jsx
frontend/src/components/PreviewStep.jsx
```

Problem area in `PreviewStep.jsx`:

```js
if (submissionMode === 'live') {
  const hasSignature = docs.every(d => d.signatures && Array.isArray(d.signatures) && d.signatures.length > 0);
  if (!hasSignature) {
    docs.forEach(d => {
      d.signatures = [{
        signatureType: "I",
        value: "MOCK_SIGNATURE_BYPASS_FOR_TESTING_" + Math.random().toString(36).substring(7)
      }];
    });
  }

  const liveRes = await submitToETA(docs, false)
}
```

This is invalid for production.

ETA will never accept:

```text
MOCK_SIGNATURE_BYPASS_FOR_TESTING_xxx
```

The Excel Mapping path must use the exact same local signer logic used by PDF Smart Upload and Batch Upload.

## Root Cause

There are multiple signing implementations:

1. `Home.jsx -> handleTriggerETA()` signs correctly.
2. `BatchWorkflow.jsx -> handleBatchSubmit()` signs correctly.
3. `PreviewStep.jsx` still has old direct-live submission / mock-signature logic.

Because the signing logic is duplicated, Antigravity fixed one path but left Excel Mapping using the old path.

## Correct Fix

Create one shared frontend signing helper and force every live ETA submission to use it.

Do not allow any live submit to call:

```js
submitToETA(docs, false)
```

unless the documents were signed by the local signer in the same flow.

## Implementation Plan

### 1. Create shared helper

Create file:

```text
frontend/src/utils/signEtaDocuments.js
```

Recommended content:

```js
import { ensureLocalSignerActive } from "../services/api";
import { serializeToken } from "./serializeToken";

function cleanObject(obj) {
  if (Array.isArray(obj)) {
    return obj
      .map(cleanObject)
      .filter((v) => v !== null && v !== undefined && v !== "");
  }

  if (obj && typeof obj === "object") {
    const out = {};
    Object.entries(obj).forEach(([key, value]) => {
      if (key === "signatures") return;
      const cleaned = cleanObject(value);
      const isEmptyArray = Array.isArray(cleaned) && cleaned.length === 0;
      const isEmptyObject = cleaned && typeof cleaned === "object" && !Array.isArray(cleaned) && Object.keys(cleaned).length === 0;
      if (cleaned !== null && cleaned !== undefined && cleaned !== "" && !isEmptyArray && !isEmptyObject) {
        out[key] = cleaned;
      }
    });
    return out;
  }

  return obj;
}

function normalizeIssueDate(doc) {
  const safeDate = new Date();
  safeDate.setMinutes(safeDate.getMinutes() - 5);
  const fallbackIsoTime = safeDate.toISOString().replace(/\.\d{3}Z$/, "Z");

  if (!doc.dateTimeIssued) {
    return fallbackIsoTime;
  }

  const parsed = new Date(doc.dateTimeIssued);
  if (Number.isNaN(parsed.getTime())) {
    return fallbackIsoTime;
  }

  return parsed.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export async function signEtaDocuments(documents, { onStatusUpdate = null } = {}) {
  const docs = Array.isArray(documents) ? documents : [documents];

  const localSignerActive = await ensureLocalSignerActive(onStatusUpdate);
  if (!localSignerActive) {
    throw new Error("لم يتم الكشف عن أداة التوقيع. افتح FawterX Signer وتأكد من توصيل الدونجل.");
  }

  const signedDocs = [];

  for (const sourceDoc of docs) {
    const doc = {
      ...sourceDoc,
      dateTimeIssued: normalizeIssueDate(sourceDoc),
    };

    const cleanedDoc = cleanObject(doc);
    const canonicalString = serializeToken(cleanedDoc);

    const signRes = await fetch("http://localhost:8585/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ canonicalString }),
    });

    if (!signRes.ok) {
      throw new Error("فشلت عملية التوقيع محلياً.");
    }

    const signData = await signRes.json();
    if (!signData.success || !signData.signature) {
      throw new Error(signData.error || "لم يرجع برنامج التوقيع توقيعاً صالحاً.");
    }

    signedDocs.push({
      ...cleanedDoc,
      signatures: [{
        signatureType: "I",
        value: signData.signature,
      }],
    });
  }

  return signedDocs;
}
```

Important:

- Use the same `serializeToken` import path that currently works in `Home.jsx` / `BatchWorkflow.jsx`.
- If `serializeToken` is not exported from a util file yet, extract it from the current working file instead of duplicating it.

### 2. Fix Excel Mapping live submission

In:

```text
frontend/src/components/PreviewStep.jsx
```

Import:

```js
import { signEtaDocuments } from "../utils/signEtaDocuments";
```

Replace the broken mock-signature block:

```js
const hasSignature = docs.every(...)
if (!hasSignature) {
  docs.forEach(...)
}

const liveRes = await submitToETA(docs, false)
```

With:

```js
toast.loading("جاري التحقق من أداة التوقيع المحلية...", { id: "excel-mapping-submit" });

const signedDocs = await signEtaDocuments(docs, {
  onStatusUpdate: (msg) => toast.loading(msg, { id: "excel-mapping-submit" }),
});

toast.loading("تم التوقيع بنجاح! جاري إرسال الفاتورة لمنظومة الضرائب...", { id: "excel-mapping-submit" });

const liveRes = await submitToETA(signedDocs, false);
setEtaDocs(signedDocs);
```

### 3. Remove all mock signature code from live production flows

Search:

```powershell
rg -n "MOCK_SIGNATURE|BYPASS_FOR_TESTING|signature.*testing|submitToETA\\(docs, false\\)" frontend/src
```

Expected after fix:

```text
No live flow should add MOCK_SIGNATURE.
No live flow should submit unsigned docs.
```

### 4. Reuse the helper in Home and Batch later

After Excel Mapping is fixed, refactor these functions to use the same helper:

```text
frontend/src/pages/Home.jsx -> handleTriggerETA()
frontend/src/components/BatchWorkflow.jsx -> handleBatchSubmit()
frontend/src/pages/DraftDetails.jsx -> draft submit
```

This is not required to solve the current bug, but it prevents the same bug from returning.

## Mandatory Guardrail

Add a frontend guard before any live ETA submission:

```js
function assertSignedBeforeLiveSubmit(docs) {
  const list = Array.isArray(docs) ? docs : [docs];
  const missing = list.some((doc) => !Array.isArray(doc.signatures) || !doc.signatures[0]?.value);
  if (missing) {
    throw new Error("لا يمكن إرسال الفاتورة للضرائب قبل التوقيع الإلكتروني.");
  }
}
```

Then before:

```js
submitToETA(signedDocs, false)
```

Call:

```js
assertSignedBeforeLiveSubmit(signedDocs);
```

## Backend Safety Net

In:

```text
backend/src/routes/eta.js
```

Before sending a live document to ETA, reject unsigned live submissions locally:

```js
if (!dryRun) {
  const docs = Array.isArray(document) ? document : [document];
  const unsigned = docs.find((doc) => !Array.isArray(doc.signatures) || !doc.signatures[0]?.value);
  if (unsigned) {
    return res.status(400).json({
      success: false,
      message: "لا يمكن إرسال الفاتورة للضرائب بدون توقيع إلكتروني صالح.",
      details: "Missing document.signatures before live ETA submission.",
      internalId: unsigned.internalID || unsigned.internalId || null,
    });
  }
}
```

This prevents ETA quota/API calls from being wasted on known-bad unsigned payloads.

## Testing Checklist

### Excel Mapping

1. Open normal Excel Mapping flow.
2. Upload invoice.
3. Map columns.
4. Validate/dry-run.
5. Click live submit.
6. Confirm signer opens or is detected.
7. Confirm signer receives `/sign` request.
8. Confirm outgoing document contains:

```json
"signatures": [
  {
    "signatureType": "I",
    "value": "..."
  }
]
```

9. Confirm ETA no longer returns:

```text
Profile is configured to submit digitally signed documents only
```

### Regression Tests

Also retest:

- PDF Smart Upload.
- Batch Upload.
- Draft submit.

They must keep using the real local signer.

## Build & Deploy Commands

```powershell
cd C:\Users\GeMy\.gemini\antigravity\scratch\FawterX\frontend
npm run build
npx firebase deploy --only hosting
```

```powershell
cd C:\Users\GeMy\.gemini\antigravity\scratch\FawterX
git add frontend/src backend/src
git commit -m "Fix Excel Mapping live submission signing"
git push origin main
```

Render should auto-deploy the backend after GitHub push.

## Short Summary for Antigravity

The bug is not in ETA credentials and not in document type version.

Excel Mapping live submission is sending an unsigned or mock-signed document. PDF Smart Upload and Batch work because they call the local signer before `submitToETA(..., false)`.

Fix Excel Mapping by replacing the mock/direct live submit path in `PreviewStep.jsx` with the same real signer flow used by `Home.jsx.handleTriggerETA()` and `BatchWorkflow.jsx.handleBatchSubmit()`. Add a backend safety check to reject unsigned live submissions before calling ETA.
