# FawterX Release Log — v2.27.43

**Release Date:** September 2, 2026  
**Module:** High-Visibility Bar Count Typography & Sizing Across Lifecycle Tracker & Audit Tables  
**Target Platform:** Web (React + Vite + Firebase Hosting)  
**Author:** FawterX UI/UX Design & Architecture Team  

---

## 🌟 Overview & Key Highlights

Version **v2.27.43** directly responds to the owner's request to enlarge the bar count numbers across the lifecycle tracker and tables:

1. **Enlarged Bar Count Badges in Lifecycle Tracker KPI Cards:**
   - **Phase 1 Card (🟡 قيد الدهان والمعالجة):** The pending bar count (e.g. `933 BAR`) is now prominently displayed in a dedicated illuminated badge with **`fontSize: 1.6rem`** and **`fontWeight: 900`**.
   - **Phase 2 Card (🟢 تم التسليم للعميل النهائي):** The completed bar count is now displayed in a glowing green badge with **`fontSize: 1.6rem`** and **`fontWeight: 900`**.
   - **Total Dispatches Card (📦 إجمالي حركات الصرف المسجلة):** Now displays the grand total of bars across all dispatches in **`fontSize: 1.6rem`** with a blue accent badge.

2. **Enlarged Bar Counts in Individual Dispatch Cards:**
   - Within each order card header, `totalQuantityBar` has been increased to **`1.25rem`** with `fontWeight: 900` inside a neat pill container.

3. **High-Legibility Table Typography:**
   - **Audit Trail (سجل الحركات):** Total dispatched bars column styled with a prominent badge (`fontSize: 1.15rem`, `fontWeight: 900`).
   - **Review Lines Table:** `Available Warehouse Bars`, `Available Delmar Bars`, and `Requested Bars` numbers increased to `1.15rem - 1.3rem` with `fontWeight: 900`.

---

## 🚀 Modified Files
- `frontend/src/components/DispatchesTrackerView.jsx`: Enlarged KPI bar count typography to 1.6rem bold badges and order headers to 1.25rem bold.
- `frontend/src/pages/Warehouse.jsx`: Enlarged bar counts in Audit Trail table and review lines.
- `frontend/package.json`: Bumped version to `2.27.43`.
- `frontend/src/components/ReleaseNotesModal.jsx`: Added v2.27.43 release notes.
