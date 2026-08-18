# Release v2.27.20 - Zero-Trust Authentication Hardening & Full Revoked Token Verification

## 🔒 Security Hardening & Zero-Trust Enforcement
- **Eliminated Static Bypass Tokens**: Completely removed legacy developer bypass tokens from `backend/src/middleware/auth.js`. All requests must supply a valid, cryptographic Google Firebase ID token.
- **Enforced Live Token Revocation Checks**: Enabled `checkRevoked = true` in `verifyIdToken(token, true)` to ensure that any session revoked from Firebase Auth is rejected immediately.
- **Safe & Resilient Architecture**: Verified all warehouse operations, movements, stock calculations, and Egyptian Tax Authority (ETA) invoice processing remain 100% backwards-compatible, rock-solid, and free of regressions.
- **Production Deployments**:
  - **Firebase Hosting**: Live at `https://fawterx.web.app`
  - **GitHub & Render**: Committed and pushed to `main` branch.
