# Release Log - FawterX v2.27.56

**Release Date:** September 3, 2026  
**Type:** Critical Pricing Enhancement & Synonym Price Resolution  
**Component:** Universal Price Resolver (`resolveCanonicalItemPrice`), 515750/515756 Cross-Mapping

---

## Summary of Changes

### 1. Root-Cause Analysis for Zero-Cost on Item 515750
- When uploading a Schüco SD delivery note, item `515750` was matched only against an exact string in warehouse stock.
- Because Canex and Warehouse stock catalog item `515750` under `515756`, the match returned empty, resulting in `0 EGP` for `unitPrice`, `barPrice`, and `netTotal`.
- The Delmar pool and review lines lacked an automatic multi-tier fallback for known synonyms and 5-character prefix matching.

### 2. Multi-Tier Universal Price Resolver (`resolveCanonicalItemPrice`)
- Built and integrated `resolveCanonicalItemPrice` into `handleFileUpload`, `handleSyncBatchPrices`, and real-time review table row rendering.
- **Cascading Resolution:**
  1. Checks existing line prices.
  2. Automatic bidirectional synonym mapping: `515750` $\iff$ `515756`.
  3. Checks `aliasesMap` dictionary.
  4. Scans Active Delmar Dispatches (Pool) with 5-character prefix matching.
  5. Scans Warehouse Stock with 5-character prefix matching.
  6. Scans loaded Inbound/Outbound Invoices (Canex source movements) with 5-character prefix matching.
- **Immediate Visual Population:**
  - Table inputs for Unit Price, Bar Price, and Line Total now dynamically resolve and populate the true cost of item `515750` upon file upload and table display.

---

## Verification & Deployment
- **Pre-Build Verification:** Clean build with `npm run build` in 5.73s.
- **Firebase Hosting:** Deployed to `https://fawterx.web.app`.
- **Git Push:** Remote main updated with automatic backend redeployment on Render.
