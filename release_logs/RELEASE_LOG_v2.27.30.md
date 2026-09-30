# Release Log — v2.27.30

**Date:** 2026-09-02  
**Type:** Bug Fix & Enhancement — Complete 100% Invoice Line Retrieval, Dedicated Customer Code Display & Real-Time Search

---

## Overview

Resolved the issue where certain line items in inbound invoice dispatches (such as item `301-105528` in invoice `CNX3-008670`) were missing from the outbound dispense modal despite being present in stock inventory. Added a dedicated **Customer Code (`كود العميل`)** column to the line items table, eliminated duplicate item code columns, added **real-time instant search & filtering by Customer Code, Item Code, and Description**, and enabled manual line additions from stock while operating in invoice-based dispense mode.

---

## Key Changes & Improvements

1. **Complete 100% Invoice Line Retrieval & Dual-Index Lookup:**
   - Upgraded `getProjectMovements(projectId, invoiceId)` on the backend to dynamically query movements by both `invoiceId` (including sibling/duplicate batch document IDs) and `invoiceNumber` (e.g. `CNX3-008670`), while filtering out soft-deleted records.
   - Added client-side stock reconciliation in `ManualStockModal.jsx`: any stock items carrying the target invoice number in their `invoiceNumbers` history or `lastInvoiceNumber` are automatically included, guaranteeing 100% alignment with Excel stock inventory (7 out of 7 items displayed).

2. **Dedicated Customer Code (`كود العميل`) Column & UI Polish:**
   - Removed the duplicate "Item Code" column in the modal table.
   - Added a distinct, styled **Customer Code (`كود العميل`)** column showing customer codes (e.g. `515660`, `515640`, `515580`, `504610`, `515700`, `504660`, `504690`) with fallback to stock item records if missing from movements.

3. **Real-Time Line Items Search & Filtering:**
   - Integrated an instant search bar in the modal header: users can quickly filter lines by typing customer code, item code, or description.
   - Shows a live matching items counter (e.g., `7 مطابق`) while preserving selections and indices.

4. **Enhanced Stock Profile Picker:**
   - Manual stock selection dropdown options now display customer code clearly: `[عميل: 515660]`.
   - The "➕ إضافة قطاع إضافي" button is now accessible in invoice mode, allowing supplementary profile additions from stock without restrictions.

5. **Updated Main Warehouse Search Placeholder:**
   - Clarified the main search input placeholder in `Warehouse.jsx` to explicitly mention searching by customer code (`كود العميل`).

---

## Impact

- ✅ Zero missing items when dispensing invoices; full consistency between Excel stock inventory and FawterX warehouse dispatches.
- ✅ Instant searching and clear visibility of customer codes throughout the warehouse workflow.
- ✅ 100% preservation of all previously introduced features (permissions, warehouse project selector, streamlined mandatory fields, and coating lifecycles).
