# FawterX Release Log - Version v2.26.6

**Release Date:** August 11, 2026  
**Environment:** Production (`https://fawterx.web.app`)  
**Repository Branch:** `main`

---

## 🌟 Overview & Key Updates

Version `v2.26.6` fixes a critical logic flaw in warehouse project deletion where deleted projects were automatically resurrected by the backend list initialization logic.

### 1. Eliminated Auto-Resurrection Logic (`warehouseStore.js`)
- **Root Cause Identified:** `listProjects()` previously checked if a project with code `CANEX` existed, and if missing, automatically re-created `Canex Stock` in Firestore every time `listProjects()` was called after deletion.
- **Fix Applied:** Changed `listProjects()` to ONLY instantiate a default project when `projects.length === 0` (zero total projects in system). If other projects exist (e.g. `Canex WareHouse`), deleted projects are never recreated.

### 2. Comprehensive Deletion & State Synchronization
- **Duplicate Document Erasure:** Updated `deleteProject()` to perform full cleanup of duplicate records sharing the same project code or legacy IDs.
- **Frontend Filter Synchronization (`Warehouse.jsx`):** Filtered deleted projects by both `id` and `code` upon deletion confirmation to instantly eliminate ghost rows from the UI.
