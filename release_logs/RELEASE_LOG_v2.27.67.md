# Release Log v2.27.67

## Release v2.27.67 - Delmar Coating Pool Precision & Accurate Allocation Diagnostics

### 🚀 Key Highlights & Improvements:

- **Delmar Coating Allocation Precision & False Hijacking Elimination**:
  - Eliminated the erroneous fallback in `computeBatchDelmarAllocations` and `getDelmarAvailableBars` that hijacked bars from unrelated profile pools whenever a line was coated but unlinked.
  - An item now only draws from Delmar coating pool if an actual active dispatch matching its profile code and length exists in the pool.
  - Unmatched coated profiles safely route to warehouse stock without aborting invoice save operations.

- **Bidirectional & Normalized Canonical Alias Resolution**:
  - Implemented disjoint-set union equivalence mapping in both backend `backend/src/services/warehouseCoating.js` and frontend `frontend/src/utils/warehouseCoating.mjs`.
  - Seamlessly resolves item aliases in both directions (Schüco ↔ Canex) across profile codes, customer codes, and manual link targets.
  - Added regression test in `frontend/tests/warehouseCoating.test.mjs` verifying bidirectional alias matching.

- **Granular Diagnosis & Informative Error Messages**:
  - Upgraded backend coating allocation errors to explicitly identify the failing profile code, length in mm, requested quantity, and available quantity.
  - Guides the user directly on linking the item code (Alias) or adjusting warehouse dispatch split rather than presenting a generic failure string.

- **Accurate Real-Time Header Allocation Badges**:
  - Replaced the aggregate bar comparison in the invoice card header with real-time matched allocation totals.
  - Accurately displays Delmar-covered bars, warehouse-dispatched bars, and highlights unmatched profiles with zero Delmar stock.
  - Fully Covered badge (`✅ مغطى بالكامل من دلمار`) only displays when 100% of the invoice items are matched and covered by Delmar dispatches.

- **Comprehensive Verification & Live Deployment**:
  - Passed all 75 backend tests in Jest across 5 test suites (`npm --prefix backend test -- --runInBand`).
  - Passed all 4 warehouse coating unit tests (`node --test frontend/tests/warehouseCoating.test.mjs`).
  - Rebuilt production bundle with Vite (v2.27.67).
  - Deployed live to Firebase Hosting (`https://fawterx.web.app`).
  - Pushed commits to GitHub main branch with automatic synchronization to Render backend.
