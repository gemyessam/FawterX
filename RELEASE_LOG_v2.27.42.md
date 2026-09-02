# FawterX Release Log — v2.27.42

**Release Date:** September 2, 2026  
**Module:** Auto-Fulfillment of Delmar Coating Dispatches & Inbound Cost Valuation for Outbound Deliveries  
**Target Platform:** Web (React + Vite + Firebase Hosting & Node.js Express on Render)  
**Author:** FawterX Core Architecture Team  

---

## 🌟 Overview & Key Highlights

Version **v2.27.42** addresses two critical inventory accounting and lifecycle management requirements reported by the owner:

1. **Auto-Deduction and Lifecycle Closure of Delmar Dispatches:**
   - Previously, when an outbound delivery invoice (SD) was processed with `delmarCovered: true` or `delmarBars > 0`, the main warehouse was spared, but active records in the `dispatches` collection were not marked as delivered.
   - Now, when an outbound invoice is dispatched from Delmar, the backend automatically reconciles with active Delmar coating orders, deducts fulfilled quantities, and transitions the records to:
     - `currentStage: "delivered_to_customer"`
     - `isCompleted: true`
     - With full history logging noting delivery order reference (e.g. `SD 594`).
   - The Lifecycle Tracker view now correctly shows zero pending coating bars for fulfilled orders.

2. **Automatic Inbound Acquisition Cost Valuation (Elimination of `0.00 EGP`):**
   - Schüco delivery notes (SD PDFs) do not specify unit selling prices. Previously, this caused outbound movements and invoices to be recorded with a total value of `0.00 EGP`.
   - Now, for unpriced outbound deliveries, the system automatically looks up each profile's original **Inbound Cost** (`lastBarCost`, `lastUnitCost`, or previous inbound supply invoice prices).
   - Computes:
     $$\text{Line Cost} = \text{Bars} \times \text{Bar Cost} \quad \text{or} \quad \text{LM} \times \text{Meter Cost}$$
   - Pre-populates the review table before saving, and stores the true cost value in the transaction audit trail.

3. **Retroactive Reconciliation Action:**
   - Integrated a backend endpoint and frontend one-click button:
     `[ 🔄 تدقيق وتحديث تكاليف الصرف ومخزن دلمار ]`
   - Automatically backfills real cost for existing zero-amount invoices (like `SD-000000594`) and closes the 3 open Delmar batches (58, 368, 507 bars) that were delivered to customer `Sotalux`.

---

## 🚀 Modified Files
- `backend/src/services/warehouseStore.js`: Added `resolveItemInboundCost`, `fulfillDelmarDispatches`, `reconcileDelmarAndCosts`.
- `backend/src/routes/warehouse.js`: Registered `POST /projects/:projectId/reconcile-delmar-and-costs`.
- `frontend/src/services/warehouseApi.js`: Added `reconcileWarehouseDelmarAndCosts`.
- `frontend/src/pages/Warehouse.jsx`: Added reconciliation action, silent auto-reconcile on invoice load, and inbound cost pre-population.
- `frontend/package.json`: Bumped version to `2.27.42`.
- `frontend/src/components/ReleaseNotesModal.jsx`: Added v2.27.42 release notes.
