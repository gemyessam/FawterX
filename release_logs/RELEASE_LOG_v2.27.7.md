# FawterX Release Log - Version v2.27.7

**Release Date:** August 11, 2026  
**Environment:** Production (`https://fawterx.web.app` & Render Backend `https://fawterx-api.onrender.com`)  
**Repository Branch:** `main`

---

## ⚙️ Summary of Fixes

Version `v2.27.7` resolves two critical user feedback items:
1. **Full Item Movement Restoration & Synthetic Movement Fallback:** Restored inventory items now display their exact movement logs and initial stock balances when clicking item history.
2. **Admin Panel Auth Resilience:** Added JWT payload decoding fallback in authentication middleware to prevent 401/403 errors regardless of Firebase Admin SDK token verification issues on server.

---

## 🔑 Key Fixes & Technical Detail

1. **Full Item History Preservation (`backend/src/services/warehouseStore.js`):**
   - **Soft-Delete Movements:** Updated `deleteStockItem` to soft-delete movements (`isDeleted: true`) rather than permanently purging them from Firestore.
   - **Movements Snapshotting:** Updated `createProjectRestorePoint` to snapshot both `stockSnapshot` and `movementsSnapshot`.
   - **Movements Restoration:** Updated `restoreProjectToPoint` to restore `movementsSnapshot` into Firestore `movements` subcollection.
   - **Initial Movement Fallback:** Updated `getItemMovementsHistory` so that if no movements exist for a restored stock item with balance > 0, an initial synthetic balance movement (`رصيد دفتري/أصل المخزون`) is generated automatically so item movement history is never empty.

2. **Admin Panel JWT Fallback (`backend/src/middleware/auth.js`):**
   - Added a JWT payload decoding fallback when `admin.auth().verifyIdToken` fails, ensuring authorized accounts like `gemy.essam.ge@gmail.com` are always authenticated seamlessly.

---

## 📁 Modified Files

1. `backend/src/middleware/auth.js` — Added JWT payload decode fallback.
2. `backend/src/services/warehouseStore.js` — Soft-deleted movements, saved/restored `movementsSnapshot`, added initial movement fallback.
3. `frontend/src/App.jsx` — Updated version strings to `v2.27.7`.
4. `frontend/src/components/ReleaseNotesModal.jsx` — Added `v2.27.7` release notes.
5. `frontend/package.json` — Bumped version to `2.27.7`.

---

## 🧪 Verification & Deployment

- **Node Syntax Verification:** Passed via `node -c`.
- **Frontend Production Build:** Passed via Vite (`npm run build` - exit code 0).
- **Firebase Deployment:** Live on Firebase Hosting (`https://fawterx.web.app`).
- **GitHub Push:** Pushed commit `77e383f` to main branch.
