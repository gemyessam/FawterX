# Release Log - FawterX v2.27.50

**Release Date:** September 3, 2026  
**Type:** Feature Enhancement & Traceability  
**Component:** Warehouse Audit Trail, Dispatches Lifecycle Tracker, Manual Stock Dispense

---

## Summary of Changes

### 1. Human-Readable Source Invoice Reference Tracking
- **Automatic Resolution:** Replaced cryptic internal IDs (e.g. `FROM-INV-6KLB6jW0Vcwti8BWqZnD`) across the system with clean, human-readable source invoice numbers and customer references.
- **Audit Trail Table (`سجل الحركات والتوريدات`):**
  - Displays a dedicated badge `🔗 صرف من فاتورة: [رقم الفاتورة]` with customer reference `(مرجع: ...)`.
  - Added source invoice details in the Invoice Details Modal.
  - Included source invoice references in Excel exports and search filtering.
- **Dispatches Tracker (`تتبع مراحل الصرف والدهان`):**
  - Displays the source invoice badge on each dispatch card header and in the details grid.
  - Integrated source invoice reference into the dispatches search filter.

### 2. Manual Stock Movement Enhancement (`ManualStockModal.jsx`)
- Automatically captures and forwards `sourceInvoiceId`, `sourceInvoiceNumber`, and `sourceInvoiceReference` when selecting an inbound invoice to dispense from.
- Pre-populates sales order, customer reference, and destination site from the source invoice.

### 3. Backend Store Persistence (`warehouseStore.js`)
- Persists `sourceInvoiceId`, `sourceInvoiceNumber`, and `sourceInvoiceReference` onto both dispatch records (`dispatches`) and manual movement invoice entries (`invoices`).
- Automatically resolves source invoice number if raw `FROM-INV-<id>` is provided.

---

## Verification & Deployment
- **Pre-Build Verification:** Passed cleanly with 0 errors via `npm run build`.
- **Firebase Hosting:** Deployed to `https://fawterx.web.app`.
- **Git Commit:** Committed and pushed to remote main branch (GitHub & Render).
