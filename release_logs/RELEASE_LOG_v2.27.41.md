# FawterX Release Log — v2.27.41

**Release Date:** September 2, 2026  
**Module:** Collapsible On-Demand Canex Manual Link Input  
**Target Platform:** Web (React + Vite + Firebase Hosting & Node.js Express on Render)  
**Author:** FawterX Core Architecture Team  

---

## 🌟 Overview & Key Highlights

Version **v2.27.41** addresses the UI aesthetics and space utilization requested by the owner:

1. **Collapsible On-Demand Canex Manual Link Input:**
   - Instead of permanently occupying row height and cluttering the table with a visible `[ كود كانكس (515756)... ] [ 🔗 ربط ]` box on every row, the input is now **hidden by default**.
   - Added a compact, sleek `[ 🔗 ]` toggle button directly next to the search `[ 🔍 ]` button.
   - Clicking `[ 🔗 ]` reveals the input field with autofocus, a link button, and an `[ ✕ ]` close button.
2. **Auto-Collapse & Clean Verified Badge:**
   - Once the user links a Canex code, the manual link input automatically collapses, leaving only the clean verified badge (e.g. `🔗 كانكس: 301-203708`).
3. **Ergonomic Visual Balance:**
   - Dramatically reduces vertical cell height and visual distraction, delivering a clean, modern, and uncluttered table view.

---

## 🚀 Modified Files
- `frontend/src/pages/Warehouse.jsx`: Integrated `showManualLink` toggle, auto-collapse on link, and clean UI styling.
- `frontend/package.json`: Bumped version to `2.27.41`.
- `frontend/src/components/ReleaseNotesModal.jsx`: Added v2.27.41 release notes.
