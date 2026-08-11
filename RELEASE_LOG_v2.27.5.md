# FawterX Release Log - Version v2.27.5

**Release Date:** August 11, 2026  
**Environment:** Production (`https://fawterx.web.app` & Render Backend `https://fawterx-api.onrender.com`)  
**Repository Branch:** `main`

---

## ⚙️ Summary of Fixes

Version `v2.27.5` resolves a critical backend middleware exception (`ReferenceError: isAdminEmail is not defined`) in `backend/src/routes/admin.js` that caused `/api/admin/stats` and `/api/admin/users` endpoints to return HTTP 500 Internal Server Errors, leading to the "فشل تحميل لوحة الإدارة" toast notification and empty user/stats metrics.

---

## 🔑 Key Fixes & Root Cause Analysis

1. **Backend Route Reference Fix (`backend/src/routes/admin.js`):**
   - **Root Cause:** Line 11 called `isAdminEmail(userEmail)` in the `requireAdmin` middleware, but `isAdminEmail` was missing from the file's imports.
   - **Fix:** Added `const { isAdminEmail } = require("../services/adminAccess");` to `backend/src/routes/admin.js`.

2. **Full Admin Panel Restoration:**
   - Restored 100% of user data fetching, subscriber counts, suspended accounts, and admin user metrics.
   - Solved the issue where `statsRes` and `usersRes` failed with server errors.

---

## 📁 Modified Files

1. `backend/src/routes/admin.js` — Imported `isAdminEmail` from `../services/adminAccess`.
2. `frontend/src/pages/AdminPanel.jsx` — Cleaned up error handling logic.
3. `frontend/src/App.jsx` — Updated version strings to `v2.27.5`.
4. `frontend/src/components/ReleaseNotesModal.jsx` — Added `v2.27.5` release history entry.
5. `frontend/package.json` — Version bumped to `2.27.5`.

---

## 🧪 Verification & Deployment

- **Node Syntax Check:** Passed via `node -c` on all backend files.
- **Build Verification:** Verified via Vite production build (`npm run build` - exit code 0).
- **Firebase Deployment:** Live on Firebase Hosting (`https://fawterx.web.app`).
- **GitHub Push:** Pushed commit `66773ff` to trigger automated backend re-deploy on Render.
