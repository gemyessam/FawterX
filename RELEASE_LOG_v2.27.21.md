# Release v2.27.21 - Restored Standard Schuco Invoice Number Formatting with 202303xxx Prefix

## 🔢 Schuco Invoice Number Formatting Fix
- **Fixed `normalizeSchucoInvoiceNumber`**: Resolved the check where 9-digit numbers like `000000679` were returning raw digits. Now, any Schuco/System invoice number (e.g. `000000679`, `679`, `System invoice 679.PDF`) extracts the last 3 digits and correctly prefixes `202303` to yield `202303679`.
- **Unconditional Application**: Ensured `normalizeSchucoInvoiceNumber` is applied to all Schuco invoice metadata and batch workflow screens.
- **Updated Test Suites**: Updated unit tests to verify `000000612` -> `202303612` mapping.
- **Production Deployments**:
  - **Firebase Hosting**: Live at `https://fawterx.web.app`
  - **GitHub & Render**: Committed and pushed to `main` branch.
