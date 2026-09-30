# FawterX Release Log — v2.27.34

**Release Date:** September 2, 2026  
**Module:** Warehouse Invoicing, Schüco Delivery Notes & Pre-Dispatch Stock Checker  
**Target Platform:** Web (React + Vite + Firebase Hosting & Node.js Express on Render)  
**Author:** FawterX Core Architecture Team  

---

## 🌟 Overview & Key Highlights

Version **v2.27.34** introduces a complete workflow upgrade for outbound dispatch operations:
1. **Schüco SD Delivery Note & Packing List Parser:** Native parser for Schüco shipment documents (`SD-000000594`, `Packing List`), extracting 100% of line items (all 16 items), bar quantities, linear meters, weights, and finishes (e.g. `RALY22778SD`, `ANODIZED`, `MF`), automatically categorizing the movement as Outbound (`outbound`).
2. **Real-Time Pre-Dispatch Stock Availability Checker:** Automatically matches every invoice line item against the active project's current inventory snapshot (by item code, customer code, or substrings) in real-time.
3. **Outbound Readiness Banner & Visual Status Indicators:**
   - Visual badges on each row: `🟢 In Stock (X bars)`, `🔴 Shortage (only X available)`, `⚪ Not in Stock (0 bars)`.
   - Card-level readiness summary highlighting how many items are fully available vs. having shortages.
   - Guardrails preventing accidental negative stock commits without explicit user confirmation.

---

## 🚀 Detailed Features & Improvements

### 1. Schüco Delivery Note Parser (`backend/src/utils/warehouseCanexParser.js`)
- Added `parseSchuecoDeliveryNote(text, fileName)` to detect and parse Schüco Packing Lists and Delivery Notes.
- Parses document headers: Delivery Number (`SD-...`), Sales Order (`SO-...`), customer name (`Sotalux`), and document date.
- Extracts tabular line entries with format `Pos. Code Description Qty/BAR QTY/LM NetWeight Length` and subsequent finish codes (`RALY22778SD`, `RAL7009SD`, `MF`, `ANODIZED`).
- Sets `movementType: 'outbound'` and `supplier: 'Schüco Egypt'`.

### 2. Live Inventory Stock Matching (`frontend/src/pages/Warehouse.jsx`)
- Implemented `checkStockAvailability(line, stock)` helper supporting 4-tier flexible code matching (exact item code, customer code, cross-field code, and substring matching).
- Injected an Outbound Stock Availability Banner at the top of each outbound invoice card summarizing sufficient, shortage, and missing counts.
- Added a dedicated `🔍 فحص الرصيد بالمخزن (Stock Check)` column in the invoice review table with color-coded badges and hover tooltips showing exact warehouse quantities.
- Intercepted single invoice save (`handleSaveSingleBatchInvoice`) and batch save (`handleSaveBatchInvoices`) to prompt the user with a detailed summary modal whenever an outbound invoice has items with insufficient stock.

---

## 📦 Files Changed & Refactored
- `backend/src/utils/warehouseCanexParser.js`: Added `parseSchuecoDeliveryNote`, `parseSchuecoDate`, and integrated with `parseWarehouseInvoice`.
- `frontend/src/pages/Warehouse.jsx`: Added `checkStockAvailability`, outbound stock readiness banner, table stock check column, and save confirmation guardrails.
- `frontend/src/components/ReleaseNotesModal.jsx`: Documented v2.27.34.
- `frontend/src/App.jsx`: Bumped version display to v2.27.34.
- `frontend/package.json`: Bumped version to `2.27.34`.
