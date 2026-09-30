# FawterX Release Log — v2.27.32

**Release Date:** September 2, 2026  
**Module:** Warehouse Restore Points & Snapshots  
**Target Platform:** Web (React + Vite + Firebase Hosting & Node.js Express on Render)  
**Author:** FawterX Core Architecture Team  

---

## 🌟 Overview & Key Highlights

Version **v2.27.32** addresses and resolves a runtime `ReferenceError: isAuto is not defined` when creating manual restore points from the Warehouse Restore Points dashboard.

---

## 🚀 Detailed Fixes & Improvements

### 1. Restore Point Parameter Destructuring
- **Root Cause:** In `backend/src/services/warehouseStore.js`, `createProjectRestorePoint` was defined as `({ name, description })`, omitting `isAuto` from the destructuring pattern while referencing `Boolean(isAuto)` later in the function body. This caused manual snapshot creation (which only passed `{ name, description }`) to throw a runtime `ReferenceError`.
- **Resolution:** Corrected parameter signature to `({ name, description, isAuto } = {})`. When omitted in manual point creation, `isAuto` defaults safely to `undefined` which casts cleanly to `false`, allowing manual snapshots to persist and categorize correctly.

---

## 📦 Files Changed & Refactored
- `backend/src/services/warehouseStore.js`: Added `isAuto` to `createProjectRestorePoint` parameter destructuring with default object fallback.
- `frontend/src/components/ReleaseNotesModal.jsx`: Added v2.27.32 release notes.
- `frontend/src/App.jsx`: Bumped version headers to v2.27.32.
- `frontend/package.json`: Version bumped to `2.27.32`.
