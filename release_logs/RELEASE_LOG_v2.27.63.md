# Release Log v2.27.63

## Release v2.27.63 - Duplicate Warehouse Deletion Fix & Safe Archiving Engine

### 🚀 Key Highlights & Improvements:

- **Ghost Warehouse Elimination & ID Scoping**:
  - Fixed duplicate/phantom warehouse listings caused by query fallbacks and identical project codes (`MAIN`, `CANEX`).
  - Switched deletion and stock resolution to use exact, immutable Document IDs rather than loose matching or project codes.
  - Eliminated the risk where deleting one warehouse inadvertently cascaded and removed other projects.

- **Safe Archiving & Unarchiving System**:
  - Replaced destructive project deletions with a non-destructive archiving mechanism (`setProjectArchived`).
  - All warehouse data—including current stock, catalog items, inbound/outbound invoices, movements history, dispatches tracker, cross-reference aliases, and restore points—is preserved intact.
  - Admins can view archived warehouses and restore them with a single click.

- **Comprehensive Multi-Collection Snapshots**:
  - Upgraded warehouse restore points (`warehouseSnapshots.js`) to capture and restore all 8 subcollections (`stock`, `items`, `invoices`, `movements`, `dispatches`, `itemAliases`, `deletedStock`, and `auditLogs`).
  - Implemented transactional generations and checksum validation to guarantee atomic rollback without data corruption or partial state.

- **Hardened Permissions & Access Isolation**:
  - Scoped project access strictly per Document ID; resolved ACL wildcards and prevented unauthorized cross-project access.
  - Require admin privileges for destructive or state-restoration operations.

- **Production Deployments**:
  - **Firebase Hosting**: Deployed live to https://fawterx.web.app
  - **GitHub & Render**: Committed and synced to `main` branch.
