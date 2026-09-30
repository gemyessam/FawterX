# FawterX Release Log - Version v2.27.6

**Release Date:** August 11, 2026  
**Environment:** Production (`https://fawterx.web.app` & Render Backend `https://fawterx-api.onrender.com`)  
**Repository Branch:** `main`

---

## ⚙️ Summary of Fixes

Version `v2.27.6` fixes the **Warehouse Restore Point Recovery** issue where deleting an item and subsequently restoring a saved snapshot failed to bring back deleted inventory items due to orphaned entries in the `deletedStock` collection.

---

## 🔑 Key Fixes & Technical Detail

1. **Warehouse Restore Point Fix (`backend/src/services/warehouseStore.js`):**
   - **Root Cause:** When items are deleted from stock, their `itemKey`s are registered in a `deletedStock` subcollection to prevent automatic self-healing. When `restoreProjectToPoint` executed, it copied the saved `stockSnapshot` into `stock`, but did NOT clear `deletedStock`. During subsequent `getProjectStock` calls, items present in `deletedStock` were filtered out and hidden.
   - **Fix:** Updated `restoreProjectToPoint` to automatically clear all records from `deletedStock` subcollection during snapshot restoration so that all items in the snapshot are restored 100% and visible immediately.

2. **Admin Panel Status Update:**
   - Both `/api/admin/stats` and `/api/admin/users` endpoints are live, fully functional, and verified.

---

## 📁 Modified Files

1. `backend/src/services/warehouseStore.js` — Updated `restoreProjectToPoint` to clear `deletedStock` subcollection.
2. `frontend/src/App.jsx` — Updated version strings to `v2.27.6`.
3. `frontend/src/components/ReleaseNotesModal.jsx` — Added `v2.27.6` release history entry.
4. `frontend/package.json` — Version bumped to `2.27.6`.

---

## 🧪 Verification & Deployment

- **Node Syntax Check:** Passed via `node -c` on backend services.
- **Build Verification:** Passed via Vite production build (`npm run build` - exit code 0).
- **Firebase Deployment:** Live on Firebase Hosting (`https://fawterx.web.app`).
- **GitHub Push:** Pushed commit `f745760` to main branch.
