# FawterX Release Log — v2.27.37

**Release Date:** September 2, 2026  
**Module:** Warehouse Dispatch Intelligence, Delmar Coverage Decision & Table UI UX  
**Target Platform:** Web (React + Vite + Firebase Hosting & Node.js Express on Render)  
**Author:** FawterX Core Architecture Team  

---

## 🌟 Overview & Key Highlights

Version **v2.27.37** directly addresses feedback from operational workflows regarding delivery packing lists, profile discrepancies, and table layout ergonomics:
1. **Delmar Bar Shortage Coverage Prompt ("أيوه"):** If an item has a warehouse shortage but is being coated at Delmar warehouse, the system explicitly asks: *"Available in warehouse: X bars, Required: Y bars, Shortage: Z bars. Located in Delmar coating: W bars. Would you like to cover the bar difference from Delmar?"* with a direct 1-click button: `[✅ أيوه، غطي واصرف الفرق من دلمار]`, plus a batch button to cover all shortages from Delmar in one click.
2. **Inline Manual Code Input & Reject Suggestion:** Enables warehouse operators to immediately dismiss inaccurate AI/fuzzy suggestions with `[❌ رفض الاقتراح]`, and provides an inline input field to enter the correct warehouse catalog code (e.g. `515756`), which immediately links to the alias dictionary permanently and verifies stock.
3. **Table Column Reordering:** Repositioned the **Bars (الأعواد)** column to sit immediately adjacent to the **Description (الوصف)** column for effortless quantity inspection without horizontal scrolling.

---

## 🚀 Detailed Features & Improvements

### 1. Delmar Shortage Coverage (`frontend/src/pages/Warehouse.jsx`)
- Added per-line Delmar shortage detection and confirmation prompt with status `🟢 مغطى بالكامل (X بالمخزن + Z من دلمار)`.
- Integrated `handleCoverAllDelmar(batchId)` to cover all coated item shortages from Delmar across the entire batch with one click.
- Enhanced `checkStockAvailability` to recognize `line.delmarCovered: true` as sufficient stock, allowing smooth, unblocked dispatches.

### 2. Manual Code Input & Dismissal (`frontend/src/pages/Warehouse.jsx`)
- Added `line.rejectedSuggestion` state and `handleRejectSuggestion` button.
- Added `handleManualLinkByCode(batchId, lineIndex, sourceCode, targetCodeInput)` enabling direct code typing and permanent alias persistence.
- Tightened fuzzy matching to prevent disparate profile code false positives.

### 3. Column Layout Optimization (`frontend/src/pages/Warehouse.jsx`)
- Reordered `<colgroup>`, `<thead>`, and `<tbody>` so that `الأعواد (Bars)` directly follows `وصف الصنف / القطاع (Description)`.
