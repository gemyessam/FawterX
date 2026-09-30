# FawterX Release Log - v2.22.5

**Release Date:** August 9, 2026  
**Deployment Target:** Firebase Hosting ([https://fawterx.web.app](https://fawterx.web.app)) & GitHub Repository  

---

## 🌟 Overview & Highlights

Version `2.22.5` upgrades the **FawterX Warehouse Module** search and filtering capabilities. The search bar now performs comprehensive multi-field and multi-term filtering across all stock item attributes (including customer code, finish/color, item code, description, length, and invoice numbers). Additionally, interactive search filtering has been added to the Transaction History & Audit Log tab.

---

## 🛠️ Key Changes & Enhancements

### 1. 🔍 Comprehensive Multi-Field Stock Search
- **Customer Code Included:** The stock search filter (`filteredStock`) now matches against `customerCode` (e.g., `MF`, client codes).
- **Multi-Term Search Support:** Users can enter space-separated search queries (e.g., `MF 6000` or `1200 white`) to filter stock by multiple criteria simultaneously.
- **Extended Field Coverage:** Matches across `itemCode`, `customerCode`, `description`, `finish`, `color`, `itemKey`, `lengthMm`, `lastInvoiceNumber`, `invoiceNumbers`, `supplier`, `priceUnit`, and stock quantities.

### 2. 📜 Transaction History Search Integration
- Added an active search bar to the **Transaction History & Audit Log** tab.
- Users can search past movements by invoice number, customer code, supplier name, or uploaded filename.
- Excel export on the History tab dynamically exports filtered results when a search term is active.

### 3. 🚀 Version Alignment & Deployment
- Bumped application version to `v2.22.5` across `package.json` and UI headers in `App.jsx`.
- Successfully validated production build with Vite (`npm run build`).
- Deployed live to **Firebase Hosting** and synchronized codebase to **GitHub / Render**.

---

## ⚡ Performance Note: Transaction History Fetching
- **Query Mechanism:** When opening item-specific or project-wide transaction history, the system performs a Firestore query against `warehouseProjects/{projectId}/movements`.
- **Latency Cause (1–3s):** For projects with high transaction volume or default project fallbacks, Firestore network round-trips from the cloud database to the backend/client require sequential subcollection scans and running stock balance calculations, taking ~1–3 seconds to return and compute the full chronological history chain.

---

## 🔗 Environment Summary
- **Live Version:** `v2.22.5`
- **Hosted URL:** [https://fawterx.web.app](https://fawterx.web.app)
- **Repository:** [https://github.com/gemyessam/FawterX](https://github.com/gemyessam/FawterX)
