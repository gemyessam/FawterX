# FawterX Release Log — v2.27.35

**Release Date:** September 2, 2026  
**Module:** Warehouse Outbound Logistics & Delmar Coating Dispatch Engine  
**Target Platform:** Web (React + Vite + Firebase Hosting & Node.js Express on Render)  
**Author:** FawterX Core Architecture Team  

---

## 🌟 Overview & Key Highlights

Version **v2.27.35** delivers dedicated features requested directly by the owner (الملك جمال) for managing delivery-related profiles currently being coated at Delmar:
1. **Delmar Coating Delivery Calculation:** Automatically isolates delivery-bound items that require painting/finishing (e.g. 13 line items totaling 834 bars in `SD 594.PDF`), documents their current state as "In Delmar warehouse being coated (في مخزن دلمار بتدهن)", and separates them from mill finish (MF) raw items.
2. **Owner Decision Engine (قرار المالك):** Provides the owner with full authority and 1-click batch and per-item toggles to decide whether these coated items belong to us and should be dispatched from Delmar or excluded completely from the dispatch movement without affecting inventory.
3. **Delmar Preset Integration:** Officially incorporated "Delmar Industrial Coating (مصنع دلمار للألومنيوم والدهان)" into preset supplier and audit registries.

---

## 🚀 Detailed Features & Improvements

### 1. Delivery Coating Profiler (`frontend/src/pages/Warehouse.jsx`)
- Implemented `isCoatedItem(line)` identifying finished profiles (e.g. `RAL...`, `ANODIZED`, `SD`, `POWDER`) while distinguishing raw mill finish (`MF`).
- Added the **Delmar Coating Decision Card** in the invoice review screen displaying:
  - Total coated items and bars bound for delivery at Delmar.
  - Total raw stock items and bars at the main warehouse.
  - Active vs. Excluded coated item counts.
  - Action buttons:
    - `[✅ البنود تبعنا (صرف من مخزن دلمار)]`: Approves and activates all coated lines for dispatch.
    - `[🚫 ليست تبعنا (استبعاد بنود دلمار)]`: Sets `ignored: true` across all Delmar coated lines in one click.

### 2. Table Row-Level Controls & Delmar Badges
- Displayed `🏭 دلمار (بتدهن) 🎨` badge for every coated item.
- Interactive per-row button: `[✅ تبعنا]` vs `[🚫 مستبعد]` allowing granular decisions on individual profiles.
- Integrated Delmar allocation metadata into the dispatch commit payload (`coatingSupplier`, `delmarAllocated: true`).

### 3. Delmar Supplier Preset (`frontend/src/components/ManualStockModal.jsx`)
- Registered `مصنع دلمار للألومنيوم والدهان (Delmar Industrial Coating)` at the top of `COATING_SUPPLIERS`.

---

## 📦 Files Changed & Refactored
- `frontend/src/pages/Warehouse.jsx`: Added `isCoatedItem`, `handleDelmarDecision`, Delmar calculation card, and row-level decision actions.
- `frontend/src/components/ManualStockModal.jsx`: Added Delmar Industrial Coating to supplier presets.
- `frontend/src/components/ReleaseNotesModal.jsx`: Added release notes for v2.27.35.
- `frontend/src/App.jsx`: Bumped version display to v2.27.35.
- `frontend/package.json`: Bumped version to `2.27.35`.
