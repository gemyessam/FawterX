# FawterX Release Log - Version v2.27.0

**Release Date:** August 11, 2026  
**Environment:** Production (`https://fawterx.web.app`)  
**Repository Branch:** `main`

---

## 🌟 Overview & Key Updates

Version `v2.27.0` introduces Enterprise Security Hardening, 2FA Device Verification for new devices, and complete Privacy Isolation + Minimal Data Retention for Recovery Drafts.

### 1. New Device 2FA Security Challenge (`deviceAuth.js` & `Security2FAModal.jsx`)
- **Device Fingerprinting:** Automatically tracks trusted client device fingerprints (`User-Agent` + IP hash) per user in Firestore.
- **2FA Challenge:** Prompts a 6-digit security code challenge modal whenever a user logs in from an unrecognized browser/device.
- **Device Trusting:** Registers the device as trusted upon successful 6-digit code verification.

### 2. Recovery Drafts Privacy Isolation & Minimal Storage Policy (`draftStore.js` & `Drafts.jsx`)
- **Strict Multi-Tenant User Isolation:** Drafts are queried exclusively from `users/{userId}/drafts`. Cross-user draft leakage is impossible.
- **Minimal Privacy Data Policy:** Drafts now store **ONLY**:
  1. Internal Invoice Number (`internalID`)
  2. Total Amount (`totalAmount`)
  3. Compliance/Upload Status (`status`: `uploaded` | `valid` | `invalid`)
  4. Concise Error Message (`errorMessage`) if submission failed.
  5. Timestamp (`createdAt`)
- Raw line items, customer address lines, and full JSON payloads are explicitly excluded from draft persistence to guarantee maximum privacy.

### 3. Server Fortification & API Security (`security.js`)
- **Helmet Headers:** Enforced HTTP security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`).
- **Rate Limiting:** Added `express-rate-limit` restricting IPs to 300 requests / 15 minutes to defeat DDoS and brute-force attacks.
- **Strict CORS Origin Guard:** Restricted allowed origin access exclusively to `https://fawterx.web.app` and localhost dev ports.
