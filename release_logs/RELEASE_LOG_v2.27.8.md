# FawterX Release Log - Version v2.27.8

**Release Date:** August 11, 2026  
**Environment:** Production (`https://fawterx.web.app` & Render Backend `https://fawterx-api.onrender.com`)  
**Repository Branch:** `main`

---

## ⚙️ Summary of Fixes

Version `v2.27.8` addresses two specific operational requirements:

1. **Global Step Guide Modal (`StepGuideModal.jsx`):**
   - Extracted step guide from single page state and created a dedicated top-level global modal `StepGuideModal`.
   - Now clicking "دليل الخطوات" in the main top header works instantly from any section/page (Home, Warehouse, Drafts, Admin) without dependencies on Home page state.
   - Added full keyboard navigation support (Escape to close, Arrow keys to navigate slides).

2. **Admin Panel Access Resilience & Quick Login Authorization (`auth.js` & `admin.js`):**
   - Updated quick login bypass token handling (`BYPASS_EXPRESS_LOGIN_SECRET_TOKEN_CHOCO_EGYPT_9988`) in authentication middleware to explicitly set master admin identity (`gemy.essam.ge@gmail.com`) and grant `isAdmin = true`.
   - Updated `requireAdmin` guard in `backend/src/routes/admin.js` to authorize `admin-primary-account` UID and master email seamlessly.

---

## 📁 Modified Files

1. `frontend/src/components/StepGuideModal.jsx` [NEW] — Standalone global modal component for step guide.
2. `frontend/src/App.jsx` — Integrated `StepGuideModal` in top-level Layout and updated version badge to `v2.27.8`.
3. `frontend/src/pages/Home.jsx` — Cleaned up redundant local modal markup.
4. `backend/src/middleware/auth.js` — Granted full admin identity to quick login bypass token.
5. `backend/src/routes/admin.js` — Added UID bypass check for master admin account.
6. `frontend/src/components/ReleaseNotesModal.jsx` — Added `v2.27.8` release log entry.
7. `frontend/package.json` — Bumped version to `2.27.8`.

---

## 🧪 Verification & Deployment

- **Vite Production Build:** Passed (`npm run build` - exit code 0).
- **Firebase Deployment:** Live on Firebase Hosting (`https://fawterx.web.app`).
- **GitHub Push:** Pushed commit `bdf053e` to main branch.
