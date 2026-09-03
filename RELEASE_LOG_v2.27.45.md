# Release Log v2.27.45 - Automated Delmar Intermediate Dispatches Fulfillment & Schüco Requested Bars & Variance Tracking

**Release Date:** September 3, 2026  
**Target Environments:** Firebase Hosting, GitHub Main, Render Auto-Sync  
**Live Production URL:** https://fawterx.web.app  

---

## 🚀 Key Highlights & Improvements

### 1. Automated Delmar Intermediate Warehouse Fulfillment & Lifecycle Closure
- **Root Cause Resolved**: Fixed issue where saving an outbound delivery invoice (`SD-000000594`) did not execute `fulfillDelmarDispatches`, leaving Delmar's coating dispatches uncompleted in Stage 1 (`in_coating`).
- **Seamless Fulfill Hook**: Connected `fulfillDelmarDispatches` directly into `processInboundInvoice` for all outbound delivery transactions.
- **Stage 2 Completion**: Active Delmar dispatches (933 bars across active batches) are automatically updated to `currentStage: "delivered_to_customer"` and `isCompleted: true`, recording the delivery note number, date, and audit trail in `stageHistory`.
- **Accurate Balance Deduction**: Dispatched coated bars are deducted from the intermediate Delmar warehouse rather than mistakenly exhausting raw warehouse stock. Only true shortages/variances (25 bars) are drawn from the main warehouse.

### 2. High-Visibility Schüco Requested Bars & Delmar Balance Overview
- **3-Metric Comparative Card**: Added an analytical breakdown card to the invoice review panel displaying:
  - 📋 **Total Schüco Requested Bars**: E.g., `958 BAR` (or `956 BAR`).
  - 🏭 **Actual Delmar Stock Available**: E.g., `933 BAR` across active coating orders.
  - 📦 **Main Warehouse Variance**: E.g., `+25 BAR` to be deducted from main raw stock.
- **Immediate Discrepancy Alert**: Prominent amber/red banner warning the user whenever Schüco requests more bars than Delmar currently holds, detailing exactly how the system balances both stocks.
- **Header Badges**: Updated the invoice card header with quick-read badges for requested bars, Delmar balance, and warehouse shortage.

### 3. Delmar Availability Calculation & Decision Fix
- **No More Fabricated Availability**: Corrected `getDelmarAvailableBars` in `Warehouse.jsx` so it no longer assumes Delmar has the full requested invoice quantity if unmapped; it strictly caps availability to the real sum of active dispatches in Delmar.
- **Delmar Decision Button**: Upgraded the `✅ البنود تبعنا (صرف من مخزن دلمار)` button to explicitly set `delmarCovered: true`, `delmarMode: "full"`, and `delmarPriority: "delmar"`.

### 4. One-Click Instant Sync & Reconciliation
- **Dispatches Tracker**: Added a `⚡ مطابقة وإغلاق أوامر دلمار` button in `DispatchesTrackerView.jsx` allowing users to retroactively reconcile and complete active Delmar orders against already registered outbound invoices.
- **Transaction History**: Added an identical `⚡ مطابقة وتحديث مخزن دلمار` button in the Audit Trail tab in `Warehouse.jsx`.

---

## 📦 Modified Files
- `backend/src/services/warehouseStore.js`:
  - Defined `isCoatedItem` helper.
  - Implemented robust `fulfillDelmarDispatches` logic.
  - Called `fulfillDelmarDispatches` in `processInboundInvoice`.
  - Added auto-integrity check in `getProjectDispatches`.
  - Added Delmar fulfillment and stock adjustment in `reconcileDelmarAndCosts`.
- `frontend/src/pages/Warehouse.jsx`:
  - Corrected `getDelmarAvailableBars` and integrated `aliasesMap`.
  - Updated `handleDelmarDecision` to configure Delmar coverage, priority, and mode.
  - Updated `handleSaveSingleBatchInvoice` and `handleSaveBatchInvoices` to pass `preparedLines` and reload dispatches.
  - Added requested bars and variance badge to header.
  - Added 3-metric KPI board and variance warning to Delmar card.
  - Added Delmar sync button in History tab.
- `frontend/src/components/DispatchesTrackerView.jsx`:
  - Imported `reconcileWarehouseDelmarAndCosts`.
  - Added `handleReconcileDelmar` and the `⚡ مطابقة وإغلاق أوامر دلمار` action button.
- `frontend/src/components/ReleaseNotesModal.jsx`:
  - Added release notes entry for `v2.27.45`.
- `frontend/package.json`:
  - Bumped version to `2.27.45`.

---

## 🌐 Production Deployments
- **Firebase Hosting**: Deployed live to https://fawterx.web.app
- **GitHub & Render**: Committed and pushed to `main` branch.
