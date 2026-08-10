# Release Log v2.26.1 - Dynamic Excel SUBTOTAL Formulas & AutoFilter Support

**Release Date:** August 10, 2026  
**Version:** v2.26.1  
**Module:** Warehouse Stock & History Excel Export  

---

### 🌟 Key Highlights & Features

1. **Dynamic Excel SUBTOTAL Formulas (`=SUBTOTAL(9, ...)`)**
   - Replaced static numeric total cells in exported Excel spreadsheets with native `=SUBTOTAL(9, ...)` formulas.
   - Total rows now dynamically recalculate when users apply custom filters in Microsoft Excel or Google Sheets.
   - Configured formulas for Stock Quantity (Bars), Meters (LM), Weight (KG), Total Amount, and Transaction History summaries.

2. **Native Excel AutoFilter Support**
   - Enabled native Excel `AutoFilter` ranges across column headers in exported `.xlsx` files (`A1:N{lastRow}` and `A1:M{lastRow}`).
   - Instant drop-down filtering is ready as soon as the user opens the exported document.

---

### 🛠️ Technical Improvements & Bug Fixes

- **Formula Compatibility:** Formula values defined using ExcelJS `{ formula, result }` object structure for immediate visual rendering and Excel recalculation compatibility.
- **Version & Deployment:** Bumped package version to `v2.26.1`, passed clean production build, and deployed live to Firebase Hosting.

---

### 🚀 Deployment Verification

- **Production Build Status:** `SUCCESS` (Vite v5.4.21 bundle built in 5.32s)
- **Firebase Hosting Status:** `DEPLOYED` (https://fawterx.web.app)
- **Render Backend Status:** Synchronized with `origin/main` commit.
