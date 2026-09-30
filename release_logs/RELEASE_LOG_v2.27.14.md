# Release v2.27.14 - Production-Grade 2FA Email OTP Security System

## 🚀 Key Highlights & Security Hardening
- **Email-Only OTP Delivery**: Replaced insecure client-side demo code reflection with end-to-end encrypted 6-digit OTP delivery directly to the user's verified email via Nodemailer & SMTP.
- **Eliminated Frontend & API Token Leaks**: Removed any reflection of `challengeCodeDemo` or plain-text OTPs across all REST endpoints and modal view states.
- **Rate Limiting & Cooldown Protection**: Added a strict 60-second cooldown timer for code re-sending, along with brute-force attempt limits (max 5 invalid attempts before challenge invalidation).
- **Masked Email Identity UX**: Display masked email pattern (e.g. `s***@gmail.com`) for privacy and clarity, with instant account switch / sign out options.
- **Production Deployments**:
  - **Firebase Hosting**: Deployed live at `https://fawterx.web.app`
  - **GitHub & Render**: Synchronized on `main` branch for automatic backend deployment.
