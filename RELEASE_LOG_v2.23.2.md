# FawterX Release Log - Version 2.23.2

## 🚀 Key Updates & Technical Improvements

### 1. Customer Reference & Metadata Sanitization Engine
- **Bug Fix for Incorrect Label Parsing:** Fixed an issue where empty or missing `Customer Reference` fields in PDF/Excel invoices caused the parser to capture adjacent section header labels (such as `:Commercial Invoice Date`) as the field value.
- **Label Filter & Sanitizer:** Added `isKnownLabel` and `sanitizeMetaValue` functions to validate extracted metadata strings and discard string artifacts matching document header labels.
- **Enhanced Variant Support:** Expanded label matching to handle multiple Customer Reference variations (`Customer Reference`, `Customer Ref`, `Cust Ref`, `PO #`, `Purchase Order`) and Sales Order variants (`Sales Order #`, `S.O. #`, `SO #`).

### 2. Excel Header Metadata Extraction
- **Full-Text Sheet Metadata Extraction:** Updated `parseWorkbook` in `warehouseCanexParser.js` to extract raw sheet text using `XLSX.utils.sheet_to_txt` / `sheet_to_csv` and process header key-value metadata automatically for Excel files.

---

## 🛠️ Verification & Deployment
- **Syntax & Unit Check:** Validated parser module loading via Node.js runtime.
- **Frontend Build:** Compiled production bundle with Vite (`npm run build`).
- **Firebase Hosting:** Deployed live updates to `https://fawterx.web.app`.
- **GitHub Repository:** Synchronized and pushed changes to `origin/main`.
