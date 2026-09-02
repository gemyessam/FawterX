# FawterX Release Log — v2.27.33

**Release Date:** September 2, 2026  
**Module:** Warehouse Invoicing, Excel Parsing & Outbound Lifecycle  
**Target Platform:** Web (React + Vite + Firebase Hosting & Node.js Express on Render)  
**Author:** FawterX Core Architecture Team  

---

## 🌟 Overview & Key Highlights

Version **v2.27.33** introduces major enhancements across invoice processing, data validation, and dispatch automation:
1. **Multi-Format Excel Spreadsheet Parser:** Added full support for tabular warehouse and shipment spreadsheets (such as Schueco/Canex warehouse balances) containing non-standard column headers (`Item number`, `External`, `Size`, `Configuration`, `Warehouse (Bars)`, `Sales order`, `Customer reference`), parsing 100% of line items and metadata without requiring standard invoice blocks.
2. **Strict Mandatory Validation for Sales Order # & Customer Reference:** Prevents saving any invoice (individual or batch) if either `salesOrder` or `customerReference` is missing or empty. Highlights missing inputs in red with `* Required` badges.
3. **Smart Outbound Dispatch Auto-Fill:** Persists the last used dispatch metadata (`coatingSupplier`, `customerName`, `projectNameOrSite`, `targetFinish`, `dispatchType`, `notes`) into local storage and auto-populates them on opening the outbound modal, eliminating repetitive re-typing.

---

## 🚀 Detailed Features & Improvements

### 1. Robust Excel & Matrix Scanner (`backend/src/utils/warehouseCanexParser.js`)
- Scans sheet 2D matrix across the first 35 rows for `Sales Order` and `Customer Reference` labels, inspecting adjacent horizontal cells and cells below to overcome merged cells or empty divider columns.
- Enhanced table header synonyms:
  - `itemCode`: maps `"item number"`, `"item code"`, `"item"`, `"code"`, `"profile"`.
  - `customerCode`: maps `"external"`, `"customer code"`, `"cust code"`, `"schueco code"`.
  - `quantityBar`: maps `"warehouse (bars)"`, `"bars"`, `"qty bar"`, `"quantity"`, `"أعواد"`.
  - `lengthMm`: parses length from `"size"` (e.g. `6000-101`) or `"length"` defaults to 6000 mm.
  - `temper` and `alloy`: extracts from `"configuration"` (e.g. `T6 6063`).
  - Auto-constructs clean profile descriptions when no explicit `"description"` column is present.
- Extracts per-row `salesOrder` and `customerReference` if specified per item in spreadsheet tables.

### 2. Frontend Upload Queue & Mandatory Enforcement (`frontend/src/pages/Warehouse.jsx`)
- Exposed `مرجع العميل (Ref)` directly in the invoice card header alongside `SO #`.
- Injected dynamic validation styling: inputs with missing data receive an attention-grabbing red outline and `*` required mark.
- Blocked `handleSaveSingleBatchInvoice` and `handleSaveBatchInvoices` with clear, actionable toast notifications whenever an invoice has blank SO or Ref fields, automatically expanding the affected invoice card.

### 3. Outbound Metadata Auto-Fill (`frontend/src/components/ManualStockModal.jsx`)
- Auto-saves outbound lifecycle form fields to `localStorage` under `fawterx_last_dispatch_meta` upon successful dispatch.
- Auto-populates all dispatch fields when opening the modal in `outbound` mode.
- Provides a clear indicator badge `✨ تم استرجاع بيانات آخر صرف تلقائياً` and a 1-click reset button `🗑️ مسح`.

---

## 📦 Files Changed & Refactored
- `backend/src/utils/warehouseCanexParser.js`: Implemented `scanMatrixForMetadata`, `parseSizeToLengthMm`, `parseConfiguration`, expanded `KNOWN_LABELS`, and updated `parseWorkbook`.
- `frontend/src/pages/Warehouse.jsx`: Added Customer Ref to card header, styled required alerts, and added pre-save validation.
- `frontend/src/components/ManualStockModal.jsx`: Added auto-remember from `localStorage`, UI indicator badge, and reset button.
- `frontend/src/components/ReleaseNotesModal.jsx`: Added v2.27.33 release notes.
- `frontend/src/App.jsx`: Bumped version headers to v2.27.33.
- `frontend/package.json`: Bumped version to `2.27.33`.
