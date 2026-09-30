# Release Log v2.27.66

## Release v2.27.66 - Security & Cryptographic Hardening: Key Enforcement, Plaintext Fallback Elimination & Write-Atomicity

### 🚀 Key Highlights & Improvements:

- **Cryptographic Key Enforcement (SEC-01)**:
  - Enforced mandatory `ENCRYPTION_SECRET` (minimum 32 characters) across all runtime environments (including unset `NODE_ENV` and production).
  - Eliminated hardcoded fallback encryption keys from the source code.
  - Test-mode encryption key injection strictly governed via `setTestEncryptionKey()` with fail-fast validation when unconfigured.

- **Elimination of Plaintext Error Fallback**:
  - `encryptSecret` throws explicit runtime exceptions on cipher faults rather than returning raw plaintext.
  - Strict rejection of caller-supplied strings starting with `enc:` (`InvalidSecretFormat`), ensuring client-side callers cannot bypass server-side encryption.
  - Whitespace-only strings are properly encrypted like any other secret, with explicit clearing reserved strictly for `null` and `""`.

- **Atomic Firestore Persistence (Zero Partial Writes)**:
  - Secret encryption in `saveUserSettings` occurs in-memory prior to any database operation; any failure immediately aborts with zero Firestore writes.
  - Omitted settings fields (`undefined`) are cleanly excluded from updates, preventing empty map `{}` writes from erasing nested fields.
  - Sanitized outward error messages and server-side logs (`[REDACTED]`), preventing secret leakage or internal OpenSSL trace exposure in API responses.

- **Legacy Compatibility & Dual-Key Read Fallback**:
  - Unencrypted historical secrets without `enc:` prefix read cleanly without errors.
  - Configurable `LEGACY_ENCRYPTION_SECRET` environment variable provides decryption-only fallback for historical records while all new writes strictly use the primary key.

- **Independent Review & Comprehensive Verification**:
  - Reviewed and approved by Codex (`PLAN_APPROVED` and `REVIEW_PASSED — A1-SEC-01-DIFF-R3`).
  - Added 21 isolated regression tests in `backend/tests/cryptoUtil.test.js` covering key enforcement, tamper resistance, cipher fault injection, and zero-write atomicity.
  - Full test pass: 75/75 backend unit tests across 5 suites, 4/4 frontend warehouse tests.
  - Rebuilt production bundle with Vite.
  - Deployed live to Firebase Hosting (`https://fawterx.web.app`) and pushed to GitHub / Render.
