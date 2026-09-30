# FawterX Release Log - Version 2.23.1

## 🚀 Key Updates & Technical Improvements

### 1. Batch Invoice Upload & Queue Management Engine
- **Multi-File Queue:** Transformed single-file upload into an interactive batch processing queue (`batchInvoices`). Users can select multiple Excel files simultaneously.
- **Accordion UI Review:** Built an intuitive accordion interface allowing per-file inspection, line-item preview/editing, metadata modification (Supplier, Invoice Number, Sales Order, Customer Reference), and removal of individual files from the batch.
- **Bulk & Individual Processing:** Enabled both "Save & Process All" for batch execution and individual item processing with real-time status feedback (`ready`, `saving`, `saved`, `error`).

### 2. Flexible Stock Movement Modes (Inbound & Outbound Batching)
- **Item-Level & Global Movement Toggling:** Allowed setting movement type (Inbound / Addition vs. Outbound / Deduction) globally for the batch or overriding per invoice.
- **Sequential Inventory Commit:** Integrated backend synchronization so stock deductions and additions update stock metrics (Bars, Meters, Weight) with transaction logging.

### 3. Comprehensive Column Visibility & Sales Order Traceability
- **Dynamic Table Column Controls:** Added column visibility toggle controls (`showColumnsModal`) allowing customized view configurations stored in browser `localStorage`.
- **Sales Order & Customer Reference Search:** Exposed Sales Order (`lastSalesOrder`) and Customer Reference (`lastCustomerRef`) in the Warehouse stock inventory view with instant multi-field searching.

---

## 🛠️ Verification & Deployment
- **Frontend Build:** Tested and validated production compilation with Vite (`npm run build`).
- **Firebase Hosting:** Successfully deployed to live production environment at `https://fawterx.web.app`.
- **GitHub Repository:** Synchronized and pushed updates to `origin/main`.
