# FawterX Release Log — v2.27.36

**Release Date:** September 2, 2026  
**Module:** Warehouse Stock Intelligence & Cross-Reference Item Aliases Engine  
**Target Platform:** Web (React + Vite + Firebase Hosting & Node.js Express on Render)  
**Author:** FawterX Core Architecture Team  

---

## 🌟 Overview & Key Highlights

Version **v2.27.36** introduces an enterprise-grade **Item Aliases & Cross-Reference Dictionary** designed specifically to resolve profile code variances between manufacturers and extrusion systems (such as Schüco master profile `515750` vs Canex extrusion catalogue `515756`):
1. **Cross-Reference Item Aliases Dictionary:** An automated mapping database per warehouse project (`warehouseProjects/{projectId}/itemAliases`) enabling seamless recognition and automatic deduction between alternative codes without modifying source files.
2. **Smart Similarity & Fuzzy Matching Engine:** Instantly detects numeric code proximity (e.g. 1-character difference on 6-digit codes `515750` vs `515756` with 95% confidence) or description overlap and offers an inline `⚡ Link & Remember` button.
3. **Interactive Quick Link Modal:** Allows warehouse managers to easily search and map any invoice line item to existing warehouse inventory with an optional checkbox to remember the mapping permanently.

---

## 🚀 Detailed Features & Improvements

### 1. Backend Cross-Reference Infrastructure (`backend/src/services/warehouseStore.js` & `backend/src/routes/warehouse.js`)
- Added `getProjectItemAliases(projectId)`, `saveProjectItemAlias(projectId, data)`, and `deleteProjectItemAlias(projectId, aliasDocId)`.
- Synchronized aliases directly into the target stock document's `aliases: [...]` array field using `FieldValue.arrayUnion`.
- Added REST API endpoints:
  - `GET /api/warehouse/projects/:projectId/aliases`
  - `POST /api/warehouse/projects/:projectId/aliases`
  - `DELETE /api/warehouse/projects/:projectId/aliases/:aliasDocId`
- Logged comprehensive audit actions: `LINK_ITEM_ALIAS` and `DELETE_ITEM_ALIAS`.

### 2. Frontend Intelligence & UI Integration (`frontend/src/pages/Warehouse.jsx` & `frontend/src/services/warehouseApi.js`)
- Integrated `aliasesMap` lookup into `checkStockAvailability`, checking both project aliases and item-level aliases arrays before falling back to manual matching.
- Developed `findSmartFuzzyMatch(line, stock, aliasesMap)` identifying high-probability candidates when an item is initially marked as missing (`⚪ Not in Stock`).
- Displayed `🔗 Alias to (...)` badges for successfully mapped profiles.
- Integrated the **Link Item Alias Modal (`LinkAliasModal`)** with instant search, profile details, available bars count, and permanent memory retention.

---

## 📦 Files Changed
- `backend/src/services/warehouseStore.js`: Added alias data layer and Firestore integrations.
- `backend/src/routes/warehouse.js`: Added alias endpoints and authorization checks.
- `frontend/src/services/warehouseApi.js`: Added alias API clients.
- `frontend/src/pages/Warehouse.jsx`: Implemented fuzzy matching, alias badges, quick link triggers, and LinkAliasModal dialog.
- `frontend/src/components/ReleaseNotesModal.jsx`: Added v2.27.36 release notes.
- `frontend/src/App.jsx`: Bumped version display to v2.27.36.
- `frontend/package.json`: Bumped version to `2.27.36`.
