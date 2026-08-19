# Release v2.27.22 - Preemptive Server Warm-up, Local Signer Auto-Wait & ETA Status Check Fixes

## ⚡ Key Improvements & Bug Fixes
- **Preemptive Server Warm-up**: Added background warm-up ping on application load to wake up the Render backend and eliminate cold-start delays on initial invoice submission.
- **Auto-Retry Mechanism**: Added transient network and cold-start automatic retry for `/api/eta/submit` to ensure uninterrupted invoice sending.
- **Smart Local Signer Auto-Wait**: Enhanced `ensureLocalSignerActive` with automatic custom protocol launching (`fawterx-signer://open`) and smart polling up to 4.5 seconds before prompting, preventing connection refused errors when opening the signer for the first time.
- **Fixed ETA Status Check Endpoint (`GET /api/eta/status/:uuid`)**: Supplied custom company credentials (`clientId`, `clientSecret`) to `getDocumentStatus`, resolving internal 500 server errors after successful document submissions.
- **Flexible Secret Verification**: Updated background credential verification to validate successfully if at least one approved active secret is present, eliminating spurious 401 warnings when Secret 2 is rotated or unassigned.
- **Production Deployments**:
  - **Firebase Hosting**: Live at `https://fawterx.web.app`
  - **GitHub & Render**: Committed and pushed to `main` branch.
