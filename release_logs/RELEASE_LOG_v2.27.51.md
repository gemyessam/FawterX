# Release Log - FawterX v2.27.51

**Release Date:** September 3, 2026  
**Type:** Core Architecture & Canonical Valuation Engine  
**Component:** Warehouse Store, Valuation Engine, Item Cross-References, Manual Stock Dispense

---

## Summary of Changes

### 1. Canonical Valuation & Cost Engine (Single Source of Truth)
- **4-Tier Structured Hierarchy:**
  1. Specific Source Inbound Invoice movements (`sourceInvoiceId`).
  2. Cross-Reference Aliases Dictionary (`itemAliases` e.g. `515750` <=> `515756`).
  3. Warehouse Stock Master (`stock` collection).
  4. Inbound Movements Audit Trail (`movements` collection).
  5. 1-character proximity fuzzy matching on extrusion codes.
- **Mathematical Harmonization:**
  - Bar Price = `UnitPrice * (LengthMm / 1000)`.
  - Net Total = `QuantityBar * BarPrice` (identical to `QuantityLm * UnitPrice`).
  - Completely eradicated the bug where `QuantityBar` was multiplied by `UnitPrice` without bar length factor.

### 2. Manual Stock Modal UI & Validation
- Integrated real-time Bar Cost and Line Total columns in the modal table.
- Added real-time movement valuation pill in the summary banner for both inbound and outbound movements.
- Added real-time zero-cost alerting badge (`⚠️ تكلفة 0 ج`) to prevent accidental unvalued dispatches.
- Connected `aliasesMap` so Schüco codes (e.g. `515750`) automatically resolve to Canex extrusion costs (`515756`).

### 3. Historical Data Healing & Reconciliation
- Enhanced `reconcileDelmarAndCosts` with the Canonical Valuation Engine to automatically heal outbound dispatches where costs were divided by profile length or recorded as zero.
- Reconciles historical dispatches back to their true valuation (e.g. 1,293,746.04 EGP).

---

## Verification & Deployment
- **Pre-Build Verification:** Clean build with 0 warnings/errors via `npm run build` in 4.74s.
- **Firebase Hosting:** Deployed to `https://fawterx.web.app`.
- **Git Push:** Remote main updated with automatic backend redeployment on Render.
