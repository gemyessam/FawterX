# FawterX Release Log - Version 2.23.0

## 🚀 Key Updates & Technical Improvements

### 1. Inbound Invoice "Upsert" & Deduplication Engine
- **Duplicate Prevention & Metadata Enrichment:** Enhanced `processInboundInvoice` in `warehouseStore.js` to check for existing invoice numbers within the project and movement type. If a match is found, missing fields (Sales Order, Customer Reference, Supplier, Invoice Date) are updated across the main document and movement records without duplicating stock quantities or item records.
- **User Notification:** Integrated client notifications to inform users when invoice metadata is merged rather than creating new stock entries.

### 2. Stock Inventory Metadata Traceability & Search
- **Stock Item Traceability:** Updated `getProjectStock` in `warehouseStore.js` to extract and expose `lastSalesOrder` and `lastCustomerRef` from movement logs for every inventory item.
- **Global Search:** Updated table search filters in `Warehouse.jsx` so users can search stock by Sales Order number and Customer Reference.

### 3. Dynamic & Persistent Column Visibility Picker
- **Customizable Stock Table:** Implemented an interactive column visibility modal/picker allowing users to show/hide specific table columns (Item Code, Customer Code, Description, Finish, SO #, Customer Ref, Length, Bars, Meters, Weight, Last Cost, Total Value, Actions).
- **LocalStorage Persistence:** Saved column visibility preferences to browser `localStorage` (`fawterx_stock_columns`) so user layout settings persist across sessions.

---

## 🛠️ Verification & Deployment
- **Frontend Production Build:** Verified compilation via Vite (`npm run build`).
- **Firebase Hosting Deployment:** Successfully deployed to production at `https://fawterx.web.app`.
- **Repository Sync:** Pushed updates to GitHub repository `origin/main`.
