# Release Log - FawterX v2.27.58

**Release Date:** September 3, 2026  
**Type:** Enterprise Security, Access Control & UI Architecture  
**Component:** Interactive Release Notes Modal (`ReleaseNotesModal.jsx`), Role-Based Navigation, Confidential Warehouse Isolation

---

## Summary of Changes

### 1. Zero-Leak Confidential Warehouse Changelog Isolation
- **Complete Information Hiding:** Unauthorized users (visitors, standard accounts, or any user without explicit warehouse access `hasWarehouseAccess || isAdmin`) are completely blocked from viewing warehouse release notes, Delmar dispatches, Schüco/Canex inventory mappings, and item cost histories.
- **Dynamic Security Gate:** The modal dynamically strips all warehouse-tagged releases from the payload and renders a clean, focused ETA Invoicing & Tax Compliance changelog for standard users.

### 2. Role-Based Segmented Switcher & Category Badging
- **Interactive Multi-Tab Switcher:** Authorized personnel (Admins & Warehouse Managers) are provided with a segmented tab navigation bar:
  - ⚡ **ETA Invoicing & Automation** (`invoicing`): Dedicated feed for all tax portal, Excel parsing, digital signing, and security updates.
  - 🔒 📦 **Warehouse & Inventory (Secret)** (`warehouse`): Confidential internal changelog with an amber alert notice highlighting sensitive valuation data.
  - 🌟 **All Updates** (`all`): Comprehensive chronological platform timeline.
- **Category Badge Indicators:** Every release card displays clear classification tags (`⚡ رفع الفواتير والمنظومة` vs `🔒 المخزون والتشغيل`).
- **Instant Search Bar:** Real-time filtering by version number, title, or keywords with category counters.

---

## Verification & Deployment
- **Pre-Build Verification:** Clean build with `npm run build` in 4.75s (zero syntax/compilation errors).
- **Firebase Hosting:** Deployed live to `https://fawterx.web.app`.
- **Git Push:** Committed and pushed to `origin main` for automated Render production synchronization.
