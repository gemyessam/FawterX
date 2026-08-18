# Release v2.27.17 - Instant Warehouse Access Revocation & Strict Auto-Save Enforcement

## 🚀 Key Highlights & Access Hardening
- **Instant Auto-Save on Permission Toggle**: Toggling the "Allow Access" switch in the user management cards now immediately triggers `updateWarehouseUserAccess` and syncs with Firestore with live toast notifications.
- **Strict Server Revocation Checks**: Updated `getUserWarehouseAccess` in `warehouseStore.js` to strictly enforce immediate denial whenever `warehouseEnabled === false` or `warehouseRole === 'disabled'`, eliminating legacy admin-role overrides.
- **Dynamic Mount Access Verification**: Added dynamic live authorization checks on the warehouse module entry point to instantly redirect any unpermitted accounts back to the dashboard with an explicit notification.
- **Production Deployments**:
  - **Firebase Hosting**: Deployed live at `https://fawterx.web.app`
  - **GitHub & Render**: Synchronized on `main` branch for automatic backend deployment.
