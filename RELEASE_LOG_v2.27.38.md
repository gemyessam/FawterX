# FawterX Release Log — v2.27.38

**Release Date:** September 2, 2026  
**Module:** Warehouse Dispatch Intelligence, Delmar Independent Column & Customer Code Tracking  
**Target Platform:** Web (React + Vite + Firebase Hosting & Node.js Express on Render)  
**Author:** FawterX Core Architecture Team  

---

## 🌟 Overview & Key Highlights

Version **v2.27.38** delivers mission-critical accuracy and transparency for factory operations and executive review:
1. **Dedicated Delmar Warehouse & Coverage Column (`🏭 مخزن دلمار والتغطية`):**  
   - An independent column right in the review table, available for **all profiles** (both Mill Finish `MF` raw profiles and `RAL` coated profiles).
   - Direct 1-click action buttons per item:
     - `[✅ صرف من دلمار بالكامل (X عود)]`: preserves main warehouse stock without deduction.
     - `[⚖️ تغطية العجز فقط (Y عود)]`: deducts available stock from main warehouse and covers remainder from Delmar.
   - Batch header controls to approve the entire delivery order from Delmar with a single click.
2. **Customer Code (`customerCode`) Tracking & Verification:**  
   - Added an explicit `كود العميل` (Customer Code) column in the multi-stage manual dispatch modal (`ManualStockModal`).
   - Integrated dual matching across both `itemCode` and `customerCode` throughout the stock check and alias resolution pipeline, eliminating false mismatches.
3. **Crystal-Clear Breakdown of "Current Stock vs Remaining After Dispatch":**  
   - Replaced ambiguous badge phrasing with a structured card detailing:
     - **Current Warehouse Stock:** `X bars`
     - **Requested Dispatch:** `Y bars`
     - **Balance After Dispatch:**
       - If full Delmar: `🟢 Preserved: X bars untouched in warehouse`
       - If shortage covered: `🟢 0 Shortage (X from wh + Y from Delmar)`
       - If normal sufficient: `🟢 Remaining: Z bars in warehouse`
       - If shortage: `🔴 Shortage: Z bars (0 remaining)`
4. **Backend Delmar Stock Integrity:**  
   - Updated `warehouseStore.js` so that dispatches fulfilled from Delmar preserve main warehouse stock from decrementing into negative numbers.

---

## 🚀 Modified Files
- `frontend/src/components/ManualStockModal.jsx`: Added customerCode input column, select options, and payload persistence.
- `frontend/src/pages/Warehouse.jsx`: Updated `checkStockAvailability`, dual matching on `customerCode`, two-column split layout for Warehouse Stock vs Delmar, and batch actions.
- `backend/src/services/warehouseStore.js`: Respects `delmarCovered` and `delmarMode` to preserve main warehouse stock.
- `frontend/package.json`: Bumped version to `2.27.38`.
- `frontend/src/components/ReleaseNotesModal.jsx`: Added v2.27.38 release notes.
