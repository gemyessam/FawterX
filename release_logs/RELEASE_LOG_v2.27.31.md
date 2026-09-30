# FawterX Release Log — v2.27.31

**Release Date:** September 2, 2026  
**Module:** Warehouse & Inventory Management System (Canex Aluminum Profiles)  
**Target Platform:** Web (React + Vite + Firebase Hosting & Node.js Express on Render)  
**Author:** FawterX Core Architecture Team  

---

## 🌟 Overview & Key Highlights

Version **v2.27.31** introduces a critical safety and data-integrity layer designed specifically for the project owner and super administrator (King Gamal). It prevents human errors and stock discrepancies by providing:
1. **Zero-Click Automatic Restore Points (Auto-Snapshots):** Captures an instant, immutable snapshot of warehouse stock balances and movement history right before any inbound invoice is processed or any manual inbound/outbound movement is executed.
2. **Instant Invoice/Movement Transaction Rollback (Undo Engine):** An administrative rollback action directly in the Transaction History table that reverses all stock deltas (subtracts received stock or adds back dispensed profiles), marks movements as cancelled/soft-deleted, updates invoice document status, and writes complete audit trails.
3. **Smart Restore Points Categorization & Filter:** Clear badges (`🔄 Auto-Snapshot` vs `💾 Manual Snapshot`) with filter buttons to instantly inspect and restore previous states in 1-click.

---

## 🚀 Detailed Features & Improvements

### 1. Automatic Zero-Click Restore Points
- **Automated Triggering:** Every inbound invoice processing run (`processInboundInvoice`) and manual stock movement (`processManualStockMovement`) automatically generates a full restore point snapshot prior to applying any database mutations.
- **Intelligent Pruning:** Keeps the most recent 30 auto-snapshots per project to avoid unbounded database growth, while preserving all manual user-created snapshots indefinitely.
- **Audit Logging:** Every snapshot creation is timestamped and recorded in the audit log.

### 2. Super Admin Instant Invoice Rollback Action
- **Dynamic Reversal Engine:** 
  - For **Inbound** transactions: Automatically deducts the received quantities (`quantityBar`, `quantityLm`, `quantityKg`) from inventory stock documents and removes the invoice reference.
  - For **Outbound** transactions: Automatically re-increments inventory stock balances, returning dispensed profiles cleanly to stock.
- **Linked Dispatch Cancellation:** If an outbound movement had an associated multi-stage dispatch lifecycle, the dispatch status is updated to `cancelled`.
- **Soft Deletion & Cancellation Flagging:** Moves associated movement records to `isDeleted: true` and marks the invoice document as `status: 'cancelled'`.
- **Pre-Rollback Snapshot:** Generates an additional auto-snapshot immediately before executing the reversal for 100% fail-safe operation.

### 3. Frontend UI Enhancements (`Warehouse.jsx`)
- **Transaction History (`activeTab === 'history'`):**
  - Displays a warning badge `⚠️ Cancelled (تم التراجع)` on rows for rolled-back invoices with muted opacity.
  - Super Admins get an action button: `⏪ تراجع (Rollback)` equipped with an informative confirmation prompt describing the exact reversal effect.
- **Restore Points Management (`activeTab === 'restore_points'`):**
  - Integrated filter pills: `All`, `🔄 Auto Snapshots`, `💾 Manual`.
  - Visual badges distinguishing automatic vs manual snapshots.

---

## 📦 Files Changed & Refactored
- `backend/src/services/warehouseStore.js`: Implemented `createAutoRestorePoint` with 30-item pruning, hooked auto-snapshots into invoice/manual handlers, created `rollbackInvoiceTransaction`, and linked manual movements to `invoices` collection.
- `backend/src/routes/warehouse.js`: Exposed `POST /api/warehouse/projects/:projectId/invoices/:invoiceId/rollback` protected by `requireAdmin`.
- `frontend/src/services/warehouseApi.js`: Added `rollbackWarehouseInvoice` API wrapper.
- `frontend/src/pages/Warehouse.jsx`: Added rollback button, modal confirmation, cancelled status badge, and restore points filter tabs.
- `frontend/src/components/ReleaseNotesModal.jsx`: Added bilingual release notes for v2.27.31.
- `frontend/src/App.jsx`: Updated application headers and badges to v2.27.31.
- `frontend/package.json`: Version bumped to `2.27.31`.
