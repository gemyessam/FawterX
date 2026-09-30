# Release v2.27.19 - Bank-Grade Security Hardening: AES-256 Encryption & Real-Time Revocation

## 🔐 Security Enhancements & Enterprise Hardening
- **AES-256-GCM Encryption-at-Rest**: Client secrets and sensitive Egyptian Tax Authority (ETA) credentials are now cryptographically encrypted before being stored in Firestore and decrypted only in ephemeral memory.
- **Sub-Second Instant Account Revocation**: Added real-time user account status checking in `authMiddleware` with high-performance caching (15-second TTL). Blocked or suspended users are immediately kicked out with `403 Forbidden` in real-time.
- **Formula Injection Sanitization (CSV/DDE Protection)**: Added automatic cell sanitization in `excelParser.js` to neutralize formula injection payloads (`=`, `+`, `-`, `@`) upon parsing Excel invoices.
- **Production Deployments**:
  - **Firebase Hosting**: Live at `https://fawterx.web.app`
  - **GitHub & Render**: Committed and pushed to `main` branch.
