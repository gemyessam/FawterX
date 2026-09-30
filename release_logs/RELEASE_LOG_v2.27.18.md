# Release v2.27.18 - Comprehensive Security Hardening & Cryptographic Token Verification

## 🛡️ Security Audit & Authorization Hardening
- **Strict Cryptographic ID Token Verification**: Removed insecure fallback base64 decoding in `auth.js`. All incoming API requests must supply an authentic, cryptographically signed Firebase ID token. Invalid/expired tokens are strictly rejected with `401 Unauthorized`.
- **Enforced Project ACL (Access Control Lists)**: Added middleware validation ensuring users can only read, update, or mutate projects included in their `allowedProjects` array.
- **Enforced Granular RBAC**: Checked `canUpload`, `canEdit`, and `canDelete` permissions on all warehouse mutation endpoints (invoice parsing, batch processing, metadata updates, and restore points).
- **Admin Role Independence**: Fixed `listWarehouseUsers` in `warehouseStore.js` so disabled warehouse permissions cannot be overridden by generic system roles.
- **Production Deployments**:
  - **Firebase Hosting**: Live at `https://fawterx.web.app`
  - **GitHub & Render**: Pushed to `main` branch.
