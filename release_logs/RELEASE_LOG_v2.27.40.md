# FawterX Release Log — v2.27.40

**Release Date:** September 2, 2026  
**Module:** Independent Warehouse & Delmar Stock Columns, Batch Priority Toolbar & De-cluttered Code Linking  
**Target Platform:** Web (React + Vite + Firebase Hosting & Node.js Express on Render)  
**Author:** FawterX Core Architecture Team  

---

## 🌟 Overview & Key Highlights

Version **v2.27.40** refines the user experience and ergonomic visibility according to the owner's exact design specifications:

1. **Independent, Uncluttered Stock Columns:**
   - **المتاح بالمخزن (Warehouse Stock):** Distinct, clear column with large bold font (e.g. `42 عود متاح`).
   - **المتاح بدلمار (Delmar Stock):** Clean, editable numeric cell (e.g. `[ 140 ] عود`).
   - **المطلوب (Requested):** High-contrast prominent number (e.g. `140 عود مطلوب`).
   - **الأولوية والتوزيع (Priority & Split):** Large, comfortable buttons: `[ 🏭 دلمار أولاً ]` / `[ 📦 المستودع أولاً ]` showing the active split below them (`دلمار: 98 | المخزن: 42`).
   - **المتبقي بعد الصرف (Remaining Balance):** A dedicated card displaying:
     - `متبقي المخزن: X عود` (green for surplus, red for shortage)
     - `متبقي دلمار: Y عود` (green/yellow for surplus, red for shortage)
2. **Prominent 1-Click Batch Priority Toolbar:**
   - An easy-to-use header bar to apply priority across all rows in the invoice with a single click:
     - `[ 🏭 الأولوية لدلمار أولاً (لكافة البنود) ]`
     - `[ 📦 الأولوية للمستودع أولاً (والعجز من دلمار) ]`
     - `[ 🔄 المستودع فقط ]`
3. **De-cluttered Code Linking (Removed Annoying Suggestions for Known Items):**
   - Removed smart fuzzy suggestion prompts for any profile that already exists in warehouse stock or is mapped via an alias.
   - Suggestions now appear **only for unreferenced/missing items**, keeping the table clean and noise-free.
4. **Larger, Comfortable Font Sizes & Spacing:**
   - Increased input, button, and typography sizes across review table cells for optimal visual comfort.

---

## 🚀 Modified Files
- `frontend/src/pages/Warehouse.jsx`: Updated `buildStockCheckResult`, `checkStockAvailability`, table colgroup, thead, and body rows.
- `frontend/package.json`: Bumped version to `2.27.40`.
- `frontend/src/components/ReleaseNotesModal.jsx`: Added v2.27.40 release notes.
