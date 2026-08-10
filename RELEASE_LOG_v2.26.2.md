# Release Log - v2.26.2 (Warehouse Permissions & UI Optimization)

**Release Date:** August 10, 2026  
**Platform Version:** v2.26.2  
**Target Environment:** Firebase Hosting (`https://fawterx.web.app`) & Render Backend (`GitHub origin/main`)

---

## 🚀 Key Features & Enhancements

### 1. Granular Warehouse Access & Project Permissions
- **Project-Level Access Control (`allowedProjects`):** Admins can assign specific warehouse projects to individual operators or grant full access (`*`). Operators only view and interact with inventory data for their assigned projects.
- **Granular Operation Rights (`canDelete`, `canEdit`, `canUpload`):**
  - **`canDelete`**: Controls whether an operator can delete stock items, batches, or full invoices.
  - **`canEdit`**: Controls editing permissions for item metadata and quantities.
  - **`canUpload`**: Controls permission to upload and process incoming Excel invoices.
- **Administrative Control Interface:** Built a dedicated management card in **Tab 4 (Projects & Settings)** allowing real-time toggling of access, roles, project scope, and specific action permissions.

### 2. Streamlined Project Management UI
- **Compact Delete Button (`🗑️ حذف`):** Redesigned the project deletion button in the Projects table to be sleek, compact, and aligned, eliminating awkward overflow or disproportionate button sizing.
- **Improved Header Controls:** Unified action button sizing and aesthetics across table headers for consistency.

---

## 🛠️ Backend & Security Updates
- **`warehouseStore.js`:** Extended `updateWarehouseUserAccess` and `listWarehouseUsers` to persist and return `allowedProjects`, `canDelete`, `canEdit`, and `canUpload` fields in Firestore user documents.
- **`warehouse.js` Route:** Updated `POST /api/warehouse/users/:uid` endpoint to accept granular permission parameters from the admin interface.

---

## 📦 Deployment Summary
1. **Frontend Version:** Updated `package.json` to `2.26.2`.
2. **Build Validation:** Vite production build executed with zero errors.
3. **Firebase Hosting:** Successfully deployed dist assets to `https://fawterx.web.app`.
4. **Version Control:** Pushed commit `768e083` to `origin/main` on GitHub to trigger Render backend deployment.
