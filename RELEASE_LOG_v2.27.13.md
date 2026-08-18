# Release Log — FawterX v2.27.13

**Date:** 2026-08-11  
**Type:** Role Hardening & UI Royal Badge Elevation  
**Scope:** Admin Panel User Management & Super Admin Privileges

---

## Changes Implemented

1. **Backend Super Admin Role Guarantee**:
   - Updated `sanitizeUserSnapshot` in `backend/src/services/adminStore.js` to explicitly enforce `admin` role and unlimited submission quotas for `gemy.essam.ge@gmail.com` and `isAdminEmail` checks regardless of Firestore raw document values.

2. **Frontend Royal Badge UI Elevation**:
   - Modified role column rendering in `AdminPanel.jsx` to display a custom golden glowing royal badge (`👑 KING / ADMIN`) for `gemy.essam.ge@gmail.com` and super admins.

3. **Version Bump**:
   - Bumped system version to `v2.27.13` across `package.json` and `App.jsx`.

---

## Deployment Status
- ✅ Tested and built frontend bundle.
- ✅ Deployed to Firebase Hosting (`https://fawterx.web.app`).
- ✅ Committed and pushed to GitHub main branch (`v2.27.13`) triggering Render backend deployment.
