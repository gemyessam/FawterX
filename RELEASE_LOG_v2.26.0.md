# Release Log v2.26.0 - Warehouse Project Deletion & Administrative Management

**Release Date:** August 10, 2026  
**Version:** v2.26.0  
**Module:** Warehouse Management & Admin Control  

---

### 🌟 Key Highlights & Features

1. **Complete Warehouse Project Deletion (`deleteProject` Backend Utility)**
   - Implemented `deleteProject` in `warehouseStore.js` to enable full deletion of a warehouse project document along with all its nested subcollections (`stock`, `invoices`, `movements`, `restorePoints`, and `auditLogs`).
   - Built recursive batch deletion logic to safely clean up orphaned subcollection documents in Firestore.
   - Enforced backend guard condition preventing deletion when only one project remains in the system to preserve application stability.

2. **Secure Administrative API Endpoint (`DELETE /api/warehouse/projects/:projectId`)**
   - Added `DELETE /api/warehouse/projects/:projectId` route in `warehouse.js` protected with `requireAdmin` middleware.
   - Integrated project deletion in `warehouseApi.js` for seamless frontend communication.

3. **Enhanced Project Management UI (`Warehouse.jsx`)**
   - Added interactive **Warehouse Projects Management** view under the Project Settings tab.
   - Displayed active project badges, project codes, descriptions, and current selection status.
   - Enabled Admin-only project deletion button with double-confirmation dialogs warning about permanent data removal.
   - Automatically re-assigned active project focus if the currently selected project is deleted.

---

### 🛠️ Technical Improvements & Bug Fixes

- **Firestore Data Integrity:** Prevention of orphaned stock or movement data through subcollection batch cleanup.
- **Admin Access Protection:** Secured all project deletion routes to ensure only authenticated Admin accounts can invoke deletion.
- **Version & Build Sync:** Bumped application version to `v2.26.0`, passed clean Vite production build, and deployed live to Firebase Hosting.

---

### 🚀 Deployment Verification

- **Production Build Status:** `SUCCESS` (Vite v5.4.21 bundle built in 5.20s)
- **Firebase Hosting Status:** `DEPLOYED` (https://fawterx.web.app)
- **Render Backend Status:** Synchronized with `origin/main` commit.
