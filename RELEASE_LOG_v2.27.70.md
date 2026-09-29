# FawterX Release Log - v2.27.70

**Release Date:** 2026-09-29  
**Deployment Target:** Firebase Hosting (`https://fawterx.web.app`) & Render Backend Sync

---

## 1. Overview & Problem Statement
- **Lifecycle Tracker Tab Unmounting & Interference:** Users reported that when switching from the Dispatches Tracker tab to the Transaction History (Audit Trail) tab, the Lifecycle Tracker cards remained visible and did not unmount properly.
- **Dispatch Details Not Opening:** Clicking the "▼ عرض التفاصيل والبنود" button failed to expand dispatch item details due to unhandled date formatting on Firestore Timestamp objects and non-unique dispatch keys.
- **Unified Items Table Clutter:** Profile items in active dispatches were previously presented in a single mixed table, making it difficult to distinguish remaining items in coating from fulfilled/delivered items.

---

## 2. Changes & Key Implementations

### A. Dispatch Details Expansion & Defensive Formatting (`DispatchesTrackerView.jsx`)
- **Robust Key Identification:** Replaced reliance on `disp.id` with `dispatchKey = String(disp.id || disp._id || disp.dispatchNumber || disp.deliveryNote || 'disp_' + idx)` to guarantee reliable toggle state management across all dispatch data sources.
- **Safe Date & Time Parsing:** Added `safeFormatDate` and `safeFormatDateTime` utilities that defensively handle Firestore Timestamp objects (`{ seconds, nanoseconds }` or `{ _seconds, _nanoseconds }`), ISO strings, and edge-case invalid dates without throwing exceptions.
- **Event Propagation Guard:** Added `e.stopPropagation()` and explicit `type="button"` on the details toggle button.

### B. Dedicated Split Tables for Remaining vs. Delivered Items
- **🟡 Remaining in Coating Table (`البنود المتبقية قيد الدهان`):**
  - Isolates profiles where `itRem > 0`.
  - Clearly displays the exact remaining bars in high-visibility gold badges (`#FFD700`).
  - Provides a direct `🗑️ تحويل للهادر` button for quick scrap recording on specific line items.
  - Displays a clean success banner when all items in the order have been fulfilled.
- **🟢 Delivered & Settled Items Table (`البنود المسلّمة والمرحّلة للعميل`):**
  - Relocates all delivered and settled items (`itDelivered > 0 || itScrap > 0`).
  - Summarizes delivered quantity, recorded scrap, and delivery completion status (`🟢 مسلّم بالكامل` / `🟠 تسليم جزئي`).
  - Displays a friendly informative empty state when no items have been delivered yet.
- **Summary KPI Pills:** Displays top-level counts for Remaining, Delivered, Scrap, and Total directly inside the expanded card header.

### C. Tab Isolation & ErrorBoundary Integration (`Warehouse.jsx` & `ErrorBoundary.jsx`)
- **React ErrorBoundary Component:** Created `ErrorBoundary.jsx` to catch any runtime rendering errors in subcomponents and prevent corruption of React's fiber tree.
- **Tab Component Protection:** Wrapped `<DispatchesTrackerView>` inside `<ErrorBoundary>` within `Warehouse.jsx` to guarantee clean tab transitions and prevent unmounted component persistence.

---

## 3. Verification & Quality Assurance
- **Unit Tests:** `node --test frontend/tests/warehouseCoating.test.mjs` passed cleanly (5/5 tests).
- **Backend Tests:** `npm --prefix backend test -- --runInBand` passed completely (5/5 suites, 75/75 tests).
- **Frontend Production Build:** `npm --prefix frontend run build` compiled cleanly without warnings or errors.
- **Live Deployment:** Successfully deployed to Firebase Hosting.
