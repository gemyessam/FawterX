# FawterX Release Log — v2.27.44

**Release Date:** September 2, 2026  
**Module:** Full 4-in-1 Complete Snapshot Restore Engine & Integrated Rollback for Delmar Dispatches & Inventory  
**Target Platform:** Web (React + Vite + Firebase Hosting & Node.js Express on Render)  
**Author:** FawterX Core Architecture & Reliability Team  

---

## 🌟 Overview & Key Highlights

Version **v2.27.44** provides a complete, rock-solid overhaul of the inventory backup, restore, and rollback systems across all 4 core collections:

1. **True 4-in-1 Complete Point Restore (Time Machine):**
   - Previously, Restore Points only captured `stock` and `movements`, leaving `invoices` and `dispatches` out of sync.
   - Now, `createProjectRestorePoint` captures the entire system state:
     - `stockSnapshot`
     - `movementsSnapshot`
     - `invoicesSnapshot`
     - `dispatchesSnapshot`
   - When restoring to ANY point (manual or auto):
     - `stock` is wiped and replaced by the snapshot.
     - `movements` is wiped and replaced by the snapshot.
     - `invoices` are cleanly wiped and restored; any invoices created after the snapshot are permanently removed.
     - `dispatches` are wiped and restored; Delmar coating orders return to their exact previous stage (e.g. `in_coating`).

2. **Integrated Outbound Rollback ("تراجع"):**
   - When rolling back an outbound delivery invoice:
     - The main warehouse inventory is credited **only** for the quantity that was actually deducted from the warehouse (`qtyBar - delmarDispatchedBars`), preventing phantom stock inflation.
     - Delmar coating dispatches fulfilled or referenced by that delivery note are automatically reopened to **`المرحلة 1: قيد الدهان والمعالجة (in_coating)`**, with delivery dates cleared and audit history logged.

3. **Elimination of Silent Background Reconciliations:**
   - Completely eliminated background silent calls on page load that modified dispatch statuses.
   - Restored UI synchronization so that restoring or rolling back automatically updates stock, invoices, and dispatches simultaneously.

4. **Auto-Integrity in Dispatches Tracker:**
   - In `getProjectDispatches`, if no active outbound delivery notes exist for a customer/project (e.g., all were rolled back or restored before), Delmar dispatches automatically retain/revert to `in_coating` (e.g., the 933 BAR under coating).

---

## 🚀 Modified Files
- `backend/src/services/warehouseStore.js`: 4-in-1 full restore point snapshot & restore logic, Delmar-aware rollback reversal, dispatches auto-integrity.
- `frontend/src/pages/Warehouse.jsx`: Removed silent background reconciliations and extra buttons; synchronized state reloads on restore/rollback.
- `frontend/package.json`: Bumped version to `2.27.44`.
- `frontend/src/components/ReleaseNotesModal.jsx`: Added v2.27.44 release notes.
