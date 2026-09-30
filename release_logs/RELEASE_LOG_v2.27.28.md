# Release Log — v2.27.28

**Date:** 2026-09-01  
**Type:** Feature Enhancement & Multi-Stage Lifecycle Pipeline — Manual Stock Inbound/Outbound and Dispatch Tracking

---

## Overview

Added complete support for **Manual Stock Movements (Inbound Supply & Outbound Dispatch)** for existing profiles and sectors, alongside a dedicated **Multi-Stage Lifecycle Pipeline (Dispatches Tracker)** for operational traceability (Coating Suppliers ➡️ Final Customer Delivery).

---

## Key Features & Architecture

1. **Manual Inbound Supply (التوريد اليدوي المباشر):**
   - Direct stock addition to any existing or newly created profile in the warehouse without needing an Excel/PDF invoice.
   - Comprehensive tracking of quantity (BAR / LM / KG), unit costs, sales orders, customer references, and delivery notes.
   - Immediate stock snapshot reconciliation and immutable movement recording.

2. **Multi-Stage Outbound & Lifecycle Tracking (الصرف اليدوي الذكي ونظام المراحل):**
   - **Stage 1 — At Coating Supplier (🟡 قيد الدهان والمعالجة):** Profiles leave raw stock and enter active tracking at the designated coating supplier/workshop with target color (RAL code), dispatch date, and delivery note number.
   - **Stage 2 — Delivered to Final Customer (🟢 التسليم للعميل النهائي والإغلاق):** One-click final delivery confirmation with receiver name and closing notes, archiving the completed cycle.
   - **Direct Outbound (مرحلة واحدة مباشرة):** Immediate dispatch and order closing for already finished/coated profiles.
   - Real-time stock validation preventing accidental negative inventory.

3. **Dispatches Tracker Dashboard (`DispatchesTrackerView`):**
   - Dedicated tab in the Warehouse module to monitor all in-progress dispatches, items currently at painters, and completed orders.
   - Granular item breakdown per dispatch and full stage transition timeline audit.

4. **Backend Store & API Endpoints:**
   - `POST /api/warehouse/projects/:projectId/manual-movement`: Handles atomic batch movements and dispatch record creation.
   - `GET /api/warehouse/projects/:projectId/dispatches`: Queries active and completed orders.
   - `PATCH /api/warehouse/projects/:projectId/dispatches/:dispatchId/stage`: Handles stage transitions with full audit logging.
   - `DELETE /api/warehouse/projects/:projectId/dispatches/:dispatchId`: Admin dispatch management.

---

## Impact

- ✅ Full operational traceability for profile painting and processing workflows.
- ✅ Zero regression on existing invoice upload, parsing, and tax submission modules.
- ✅ Fast, intuitive manual entry options directly from the stock table and invoice tabs.
