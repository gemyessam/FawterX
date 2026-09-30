# Release Log v2.27.69

## Release v2.27.69 - Partial Dispatch Delivery & Coating Scrap/Waste Management

### 🚀 Key Highlights & Improvements:

- **Partial Dispatch Delivery Support (`partially_delivered` Lifecycle Stage)**:
  - Enabled dispatches to be partially delivered without locking or blocking when only a subset of profile items have been completed and delivered to the final customer.
  - Delivered items are marked with their delivered quantities (`deliveredQuantityBar`), leaving unfinished items actively tracked in the coating pool.
  - Active coating pool logic (`getDelmarPool` & `applyAllocations`) now includes `partially_delivered` orders and computes remaining available bars as `totalQuantityBar - deliveredQuantityBar - scrapQuantityBar`.

- **Dedicated Coating Scrap / Waste (`هادر وتالف دهان`) Management**:
  - Implemented full support for recording ruined, damaged, or scrapped profiles during the coating process at Delmar Industrial Coating (`مصنع دلمار للألومنيوم والدهان`).
  - Added new backend service `recordDispatchScrap` and API route `POST /api/warehouse/projects/:projectId/dispatches/:dispatchId/scrap` to track scrap quantities (`scrapQuantityBar`) per item or settle all remaining bars.
  - Emits audit action `RECORD_COATING_SCRAP` and creates an immutable movement log of type `scrap` for transparent inventory accounting.

- **Unified 1-Click Settle & Close in Delivery Modal**:
  - In `DispatchesTrackerView`, the final delivery modal now provides 3 clear options when remaining bars exist:
    1. **Settle as Coating Scrap (Recommended)**: Deliver ready items, mark remaining bars (e.g. 5 bars) as coating scrap/waste, and complete the order lifecycle.
    2. **Partial Delivery**: Record delivery of finished items and keep remaining bars active in coating.
    3. **Full Force Close**: Deliver and close the order directly.
  - Added a dedicated "Record Scrap" button (`🗑️ تسجيل هادر دهان`) on dispatch cards and per item row in the details table.

- **Enhanced Visual Tracking & Badges**:
  - Dispatch cards now show detailed breakdown badges: Total Dispatched (`إجمالي الصرف`), Delivered (`تم تسليمه`), Scrap (`هادر دهان`), and Remaining in Coating (`متبقي دهان`).
  - Expanded profile table now displays item-by-item status badges (`مكتمل المسلّم`, `مسلّم جزئي`, `قيد الدهان`), along with remaining bar counts and individual scrap action buttons.

- **Automated Verification & Pipeline**:
  - 75 backend Jest unit tests passed (`npm --prefix backend test -- --runInBand`).
  - 5 frontend coating unit tests passed (`node --test frontend/tests/warehouseCoating.test.mjs`).
  - Frontend production build passed cleanly (`npm --prefix frontend run build`).
  - Deployed live to Firebase Hosting (`https://fawterx.web.app`).
  - Committed and pushed to GitHub main branch with automated Render synchronization.
