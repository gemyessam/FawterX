# Release v2.27.15 - Google Authenticator (TOTP) 2FA Implementation

## 🚀 Key Highlights & Security Improvements
- **Zero-Dependency 2FA via RFC 6238 TOTP**: Switched to the industry standard Google Authenticator / TOTP 2FA architecture, eliminating email server (SMTP) dependencies, delivery delays, and mailbox configuration requirements.
- **Dynamic QR Code Setup Flow**: Users setting up 2FA or new devices are presented with a crisp Base64 QR code to scan with Google Authenticator or Microsoft Authenticator, alongside a copyable manual secret key fallback.
- **Clock Drift Fault Tolerance**: Embedded a 1-step window tolerance (+/- 30s) in backend OTP verification to prevent failed attempts due to slight client/server clock skews.
- **Automated Trust Registry**: Once the 6-digit TOTP token is verified, the new device fingerprint is permanently added to the trusted devices sub-collection in Firestore.
- **Production Deployments**:
  - **Firebase Hosting**: Deployed live at `https://fawterx.web.app`
  - **GitHub & Render**: Synchronized on `main` branch for automatic backend deployment.
