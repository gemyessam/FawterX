# Release Log v2.27.68

## Release v2.27.68 - Permanent Cross-Reference Alias Linking (Schüco 515750 <=> Canex 515756)

### 🚀 Key Highlights & Improvements:

- **Built-in & Database Persistent Item Alias (515750 <=> 515756)**:
  - Formally established the equivalence between Schüco profile code `515750` and Canex profile code `515756` (and customer reference code `301-201404`) across all backend and frontend layers.
  - Automatically seeds and persists the cross-reference alias document (`alias_515750_515756`) into Firestore under `warehouseProjects/{projectId}/itemAliases` upon project access or outbound allocation.
  - Outbound dispatches and coating allocations from Delmar now automatically recognize `515750` as `515756` without requiring manual link interventions.

- **Backend Coating Allocation Equivalence**:
  - Registered `unionCodes('515750', '515756')` directly in `backend/src/services/warehouseCoating.js`'s disjoint-set data structure to ensure immediate, in-memory alias matching during pool allocation.
  - Eliminates shortages and false rejection when saving delivery invoices (such as `SD-000000594`) against Delmar coating pool dispatches.

- **Frontend Real-time Alias Synchronization**:
  - Updated `aliasesMap` in `frontend/src/pages/Warehouse.jsx` to include `515750 <=> 515756` by default and enable bidirectional resolution (`Schüco ↔ Canex`).
  - Pre-registered equivalence in `frontend/src/utils/warehouseCoating.mjs` (`findDelmarPoolMatches`) so pool matches, badges, and stock availability checks recognize the equivalence immediately.

- **Automated Verification & Deployment**:
  - All 75 backend Jest unit tests passed (`npm --prefix backend test -- --runInBand`).
  - All 4 frontend coating unit tests passed (`node --test frontend/tests/warehouseCoating.test.mjs`).
  - Production frontend successfully built with Vite (`npm --prefix frontend run build`).
  - Deployed live to Firebase Hosting (`https://fawterx.web.app`).
  - Pushed to GitHub main branch with automatic synchronization to Render backend.
