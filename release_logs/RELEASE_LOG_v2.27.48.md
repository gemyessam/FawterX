# Release Log - FawterX v2.27.48

**Release Date:** September 3, 2026  
**Type:** UI / UX Enhancement  
**Component:** Warehouse Delivery Review, Priority Toggles, Table Layout

---

## Summary of Changes

### 1. Interactive Dynamic Priority Toggle Visual State
- Added distinct visual feedback for batch priority buttons:
  - **Delmar First (`دلمار أولاً`):** Highlights in glowing emerald green (`#00e0a1`) with black text and subtle glow when active; mutes to clean slate when inactive.
  - **Warehouse First (`المستودع أولاً`):** Highlights in glowing sky blue (`#38bdf8`) with black text and subtle glow when active; mutes to clean slate when inactive.
- Persisted `delmarBatchPriority` on the batch state so the UI instantaneously switches visual styles upon click.

### 2. Full Stretch for Profile Descriptions (`وصف الصنف / القطاع`)
- Expanded description column width in `<colgroup>` from 350px to 480px.
- Set column header and table cell `minWidth` to 450px.
- Updated textarea styling to `width: 100%`, `minWidth: 100%`, and `boxSizing: border-box`, allowing technical descriptions to stretch across the full column comfortably without wrapping into narrow strips.
- Expanded table minimum canvas width from 2250px to 2400px to accommodate comfortable widescreen viewing.

---

## Verification & Deployment
- **Pre-Build Verification:** Passed with 0 errors via `npm run build`.
- **Firebase Hosting:** Deployed live to `https://fawterx.web.app`.
- **Git Commit:** Committed and pushed to remote main branch (GitHub & Render).
