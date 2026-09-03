# Release Log - FawterX v2.27.46

**Release Date:** September 3, 2026  
**Type:** Minor Enhancement / Critical Bug Fix  
**Component:** Warehouse Management, Intermediate Coating Dispatching (Delmar & Raw Stocks)

---

## Summary of Changes

### 1. Sequential FIFO Delmar Allocation Engine
- **Sequential Priority Matching:** When multiple lines within an outbound delivery note share or match the same Delmar order/item code, the allocation is executed strictly in sequential order (FIFO by invoice row):
  - The **first matching line** in order consumes from Delmar's available bars up to its required quantity (`Math.min(reqBar, availableDelmar)`).
  - The **subsequent matching line(s)** consume whatever remaining balance exists in Delmar's pool.
  - If Delmar's balance is exhausted by previous lines, the subsequent line automatically shifts **100% of its requirement to the main warehouse** (`delmarDispatched = 0, warehouseDispatched = reqBar`).

### 2. Prominent Real-time Alerts & Table Badges for Shared / Duplicate Codes
- **Invoice-level Conflict Alert Banner:** Displays a distinct amber/red warning card in the Delmar Overview Board outlining competing lines and their resolved allocation.
- **Per-Row Contextual Badges in Review Table:**
  - `🏷️ مشترك (1 من N)`: Applied to the first line granted priority.
  - `⚠️ نَفَد بسطر #X`: Applied to subsequent lines whose Delmar balance was depleted by a prior row, with explicit notice that stock was rerouted to the main warehouse.
  - `⚠️ أخذ الباقي (2 من N)`: Applied when a subsequent line takes the remainder from Delmar and covers the deficit from the main warehouse.
- **Dynamic Action Buttons:** Disables the "Delmar First" button for rows where Delmar stock is 0 and highlights "Warehouse First" with detailed split breakdown.

### 3. Synchronization with Persistence Pipeline
- Updated `handleSaveSingleBatchInvoice` and `handleSaveBatchInvoices` to use `computeBatchDelmarAllocations`, guaranteeing that saved records match the sequential split without phantom stock or duplicate fulfillment.

---

## Verification & Deployment
- **Pre-Build Verification:** Clean build with `npm run build` (0 syntax errors, 0 lint failures).
- **Firebase Hosting:** Deployed to `https://fawterx.web.app`.
- **Git Commit:** Committed and pushed to remote repositories (GitHub & Render).
