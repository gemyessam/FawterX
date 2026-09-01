# Release Log — v2.27.29

**Date:** 2026-09-01  
**Type:** Feature Enhancement & Security Access Control — Inbound Invoice-Based Bulk Dispense, Warehouse Selector & Granular Dispatch Permissions

---

## Overview

Enhanced the manual stock supply and outbound dispatch modules with **Inbound Invoice-Based Bulk & Partial Dispense**, **Target Warehouse Project Picker**, **Streamlined Required Fields (Coating Supplier as only mandatory field)**, and **Granular User Permissions (`canDispatch`, `canManual`)** integrated directly into the Access Control administration panel.

---

## Key Changes & Improvements

1. **Invoice-Based Outbound Dispense (`From Inbound Invoice` Mode):**
   - Users can now select any previously recorded inbound invoice and automatically pull all its line items into the outbound dispatch view.
   - Includes **Master "Select All / Deselect All"** toggle to dispense the entire invoice in a single click.
   - Allows fine-grained adjustments to individual line quantities with real-time stock balance validation.

2. **Warehouse / Project Selector in Modal:**
   - Active warehouse/project can be selected or switched directly from the top of the manual movement modal.

3. **Streamlined Validation Rules:**
   - Relaxed mandatory fields for coating dispatches: **Coating Supplier / Workshop is the ONLY required field**.
   - Target finish/color (RAL code) and customer name are now fully optional (with sensible defaults).

4. **Granular Access Control & Security Permissions:**
   - Added `canManual` (صلاحية التوريد والصرف اليدوي) and `canDispatch` (صلاحية صرف وتتبع مراحل القطاعات) to user warehouse profiles.
   - Enforced permission checks on both backend API routes (`POST /manual-movement`, `PATCH /dispatches/:id/stage`) and frontend UI controls.
   - Added interactive toggles in the Admin Access Control drawer to customize permissions per user.

---

## Impact

- ✅ Fast bulk dispensing of entire invoices without needing item-by-item manual entry.
- ✅ Flexible dispatch workflows with minimal required input.
- ✅ Enterprise-grade permission security for warehouse operations.
