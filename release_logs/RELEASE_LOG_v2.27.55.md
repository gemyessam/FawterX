# Release Log - FawterX v2.27.55

**Release Date:** September 3, 2026  
**Type:** Critical Bug Fix & Stability Patch  
**Component:** Batch Invoices Review Component, Variable Scope Resolution

---

## Summary of Changes

### 1. Fix Blank Screen (ReferenceError) on SD File Upload / Card Expansion
- **Root Cause:**
  - `activeDelmarDispatches` and `delmarActualBars` were referenced in the outer closure of the expanded batch card for pricing metric calculations prior to their definition in an inner sub-closure.
  - When a user uploaded an SD delivery note or expanded the batch card, React threw a `ReferenceError: activeDelmarDispatches is not defined`, unmounting the component and rendering a blank screen.
- **Resolution:**
  - Lifted `activeDelmarDispatches` and `delmarActualBars` to the top-level scope of `{batch.expanded && (() => { ... })}`.
  - Removed duplicate inner declarations.
  - Verified all variables are properly defined and safe.

---

## Verification & Deployment
- **Pre-Build Verification:** Clean build with `npm run build` in 5.06s.
- **Firebase Hosting:** Deployed to `https://fawterx.web.app`.
- **Git Push:** Remote main updated with automatic backend redeployment on Render.
