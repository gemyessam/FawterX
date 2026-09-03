# Release Log - FawterX v2.27.57

**Release Date:** September 3, 2026  
**Type:** Data Integrity & Cross-Reference Mapping  
**Component:** Tripartite Die Mapping (`301-201404` <=> `515756` <=> `515750`), Warehouse Stock, Delmar Pool

---

## Summary of Changes

### 1. Tripartite Profile Identification (Die / Customer / Manufacturer)
- Unified the three references for this specific extrusion profile across the entire system:
  - **Schüco Delivery Code:** `515750`
  - **Canex Factory Catalog Code:** `515756`
  - **Customer Die Reference:** `301-201404`
- When any of these 3 codes is parsed or searched, the system automatically resolves:
  1. Quantity availability in warehouse stock and Delmar pool (e.g. 100 bars from invoice `CNX3-008670`).
  2. Canonical bar & unit pricing from original Canex source invoices.

---

## Verification & Deployment
- **Pre-Build Verification:** Clean build with `npm run build` in 4.61s.
- **Firebase Hosting:** Deployed to `https://fawterx.web.app`.
- **Git Push:** Remote main updated with automatic backend redeployment on Render.
