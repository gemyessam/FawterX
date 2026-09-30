# FawterX Release Log — v2.27.39

**Release Date:** September 2, 2026  
**Module:** Interactive Delmar Allocation, Priority Controls & Universal Manual Canex Code Linking  
**Target Platform:** Web (React + Vite + Firebase Hosting & Node.js Express on Render)  
**Author:** FawterX Core Architecture Team  

---

## 🌟 Overview & Key Highlights

Version **v2.27.39** provides total user freedom and sleek ergonomics for warehouse inventory dispatch and cross-system code reconciliation:

1. **Interactive Number Input for Delmar Dispatched Bars (`🏭 دلمار: [ input ] عود`):**  
   - Allows users to explicitly type the exact number of bars to dispatch from Delmar for any line item.
   - Automatically and instantly computes the corresponding warehouse portion (`requested - delmarBars`) and the remaining warehouse balance (`current - warehouseDispatched`).
2. **Instant 1-Click Priority Controls:**  
   - Per-item buttons:
     - `[🏭 دلمار أولاً]` (Delmar First): Takes 100% of the requested bars from Delmar and leaves the warehouse untouched.
     - `[📦 المستودع أولاً]` (Warehouse First): Takes all available bars from the warehouse and covers only the shortage from Delmar.
     - `[🔄]` (Warehouse Only): Resets Delmar to 0 and sources the dispatch entirely from the warehouse.
   - Batch header buttons:
     - `[🏭 أولوية دلمار أولاً (لكافة البنود)]`
     - `[📦 أولوية المستودع أولاً (والعجز من دلمار)]`
     - `[🔄 المستودع فقط]`
3. **Universal Manual Canex Code Input & Linking:**  
   - Addressed the issue where invoice profile codes differ from warehouse inventory codes (e.g. Schuco `515750` vs Canex `515756`).
   - Every row now features a permanent direct input field: `[ كود كانكس (515756)... ] [ 🔗 ربط ]` alongside the search modal button.
   - Entering the Canex code immediately links the row, updates the stock check in real-time, and saves the alias permanently to the project dictionary.
4. **Clean, Streamlined UI Layout:**  
   - Consolidated table columns into an ergonomic, uncluttered interface:
     - **Item & Canex Code Column** (220px)
     - **Warehouse Stock Column** (170px)
     - **Allocation Column (Delmar / Warehouse)** (280px)
5. **Backend Precision:**  
   - Updated `warehouseStore.js` `processInboundInvoice` to deduct only `qtyBar - line.delmarBars` from the main warehouse and record `delmarDispatchedBars`.

---

## 🚀 Modified Files
- `frontend/src/pages/Warehouse.jsx`: Upgraded `buildStockCheckResult`, added priority handlers, streamlined columns, and added row-level Canex linking and Delmar numeric inputs.
- `backend/src/services/warehouseStore.js`: Integrated custom `delmarBars` subtraction and movement record.
- `frontend/package.json`: Bumped version to `2.27.39`.
- `frontend/src/components/ReleaseNotesModal.jsx`: Added v2.27.39 release notes.
