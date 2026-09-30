# FawterX Release Log - Version v2.27.4

**Release Date:** August 11, 2026  
**Environment:** Production (`https://fawterx.web.app`)  
**Repository Branch:** `main`

---

## ⚙️ Summary of Changes

Version `v2.27.4` introduces major UI and UX enhancements to the **Warehouse Access Control & Project Permissions** module within the Warehouse section. As the user base grows, managing fine-grained permissions required a more compact, searchable, and prioritized layout.

---

## 🔑 Key Features & Improvements

### 1. Priority-Based User Sorting
- **Super Admin First:** The master administrator account (`gemy.essam.ge@gmail.com`) is pinned to the very top of the list.
- **Enabled Access Accounts Next:** Accounts with active warehouse access (`warehouseEnabled: true` or `warehouseRole: admin`) appear directly under the Super Admin.
- **Other Accounts Last:** All remaining user accounts are listed afterwards, sorted alphabetically.

### 2. Live Email & Name Search Input
- Added a dedicated search bar (`🔍 Search user by email or name...`) at the top of the permission control panel.
- Enables instant real-time filtering across display names, email addresses, and user IDs.

### 3. Compact Collapsible Accordion Card UI
- Transformed monolithic expanded user blocks into sleek, compact vertical list cards stacked cleanly under each other.
- **Collapsed Header Row:** Displays user avatar, display name, email, role badge (`Super Admin`, `Warehouse Admin`, `Access Granted`, `Disabled`), quick access checkbox, and an expand toggle button (`⚙️ Permissions ▲/▼`).
- **Collapsible Detail Panel:** Expanding an account reveals its warehouse role selector, allowed projects scope, granular action rights (Can Delete, Can Edit, Can Upload), and individual Save button.

---

## 📁 Modified Files

1. `frontend/src/pages/Warehouse.jsx` — Added search state, priority sorting memoization, and compact accordion permissions UI.
2. `frontend/src/App.jsx` — Bumped application version strings to `v2.27.4`.
3. `frontend/src/components/ReleaseNotesModal.jsx` — Added release notes entry for `v2.27.4`.
4. `frontend/package.json` — Version updated to `2.27.4`.

---

## 🧪 Verification & Deployment

- **Build Verification:** Verified via Vite production build (`npm run build` - exit code 0).
- **Firebase Deployment:** Live on Firebase Hosting (`https://fawterx.web.app`).
- **Version Control:** Pushed to GitHub repository `gemyessam/FawterX`.
