# Release Log v2.27.64

## Release v2.27.64 - Dispatches Tracker Fix: Cancelled Orders Isolation, Red Badging & One-Click Cleanup

### 🚀 Key Highlights & Improvements:

- **Lifecycle Dispatches Tracker Isolation**:
  - Reconfigured the default tab to `🟡 In Coating (Active)` so users immediately see only active, pending orders rather than mixing in rolled-back dispatches.
  - Added a dedicated `⚠️ Cancelled (Rolled Back)` tab that cleanly isolates rolled-back dispatches.

- **Explicit Status Badging & Safeguards**:
  - Cancelled dispatches now render with a distinct red badge `⚠️ ملغاة (تم التراجع وعكس الرصيد)` and subtle dimmed styling instead of masquerading as `🟡 Phase 1: In Coating`.
  - The `Deliver to Customer` action button is completely suppressed on cancelled dispatches to prevent accidental lifecycle advancement.
  - An inline explanation banner explicitly informs the user that the dispatch was rolled back and the inventory returned to the main warehouse.

- **Admin One-Click Permanent Cleanup**:
  - Added a direct `🗑️ Delete Record` button on cancelled dispatch cards, allowing administrators to permanently purge cancelled tracking cards from the database with a single click.

- **Exhaustive Server-Side Cancellation on Rollback**:
  - Enhanced `rollbackInvoiceTransaction` to perform an exhaustive multi-lookup across all dispatches linked by `dispatchId`, `sourceInvoiceId`, `sourceInvoiceNumber`, or matching delivery notes (`DSP-من-...`).
  - All matching dispatch records are transactionally updated with `currentStage: "cancelled"`, `isCancelled: true`, and audit notes.

- **Verified Production Deployment**:
  - All 54 backend tests and 4 frontend tests passed cleanly.
  - Built production bundle with Vite.
  - Deployed to Firebase Hosting (`https://fawterx.web.app`) and synced to GitHub / Render.
