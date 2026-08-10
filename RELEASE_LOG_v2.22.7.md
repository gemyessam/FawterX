# FawterX Release Log - v2.22.7

**Release Date:** August 10, 2026  
**Deployment Target:** Firebase Hosting ([https://fawterx.web.app](https://fawterx.web.app)), Render Backend & GitHub  

---

## 🌟 Overview & Highlights

Version `2.22.7` addresses a critical user management bug where accounts signing in via Google Authentication were not immediately visible in the **Admin Panel** or **Warehouse Permissions List**. 

By unifying Firebase Authentication (`admin.auth().listUsers()`) user listings with Firestore document stores and introducing an automatic `user-sync` endpoint upon authentication, all Google signed-in users now appear instantly in admin control screens.

---

## 🛠️ Key Fixes & Enhancements

### 1. 🔑 Firebase Auth & Firestore User Unification
- **Admin Panel List (`adminStore.js`):** `listUsers()` and `getUserById()` now query `admin.auth().listUsers()` to discover all registered Google accounts, merging them into the active user view even if their Firestore profile document had not been created yet. Missing documents are auto-synced into Firestore `users/{uid}`.
- **Warehouse Access Control (`warehouseStore.js`):** `listWarehouseUsers()` now scans Firebase Auth accounts to display all signed-in users in the Warehouse management tab. `updateWarehouseUserAccess()` dynamically creates user records upon granting permissions without throwing `"Target user not found"`.

### 2. 🔄 Automatic Client-Side Profile Sync
- **Backend API (`/api/eta/user-sync`):** Added a lightweight authentication endpoint in `eta.js` that automatically upserts `email`, `displayName`, `photoURL`, and default roles upon user login.
- **Frontend App Integration (`App.jsx` & `api.js`):** Integrated `syncUserData` into `onAuthStateChanged` and `handleGoogleLogin` so every user session instantly registers in Firestore.

### 3. 🚀 Build & Production Deployment
- Bumped application version to `v2.22.7` across UI and `package.json`.
- Production bundle compiled via Vite (`npm run build`).
- Deployed live to **Firebase Hosting** and pushed backend changes to **GitHub / Render**.

---

## 🔗 Environment Summary
- **Live Version:** `v2.22.7`
- **Hosted Application:** [https://fawterx.web.app](https://fawterx.web.app)
- **Repository:** [https://github.com/gemyessam/FawterX](https://github.com/gemyessam/FawterX)
