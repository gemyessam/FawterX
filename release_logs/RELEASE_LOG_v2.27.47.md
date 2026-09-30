# Release Log - FawterX v2.27.47

**Release Date:** September 3, 2026  
**Type:** UI Streamlining & UX Optimization  
**Component:** Warehouse Management, Delivery Invoice Review Strip

---

## Summary of Changes

### 1. Compact Organizational Metric Pills
- Consolidated redundant statistics and bulky nested cards into a single high-efficiency dashboard strip:
  - **Schüco Requested Bars:** Clear count and length (`BAR` and `m`).
  - **Delmar Actual Stock:** Live active bars and active order count.
  - **Warehouse Shortage / Balance:** Real-time variance to be deducted from raw stock.
  - **Stock Check Indicator:** Instant count of sufficient vs deficit items.
- Streamlined Priority and Scope toggles (`Delmar First`, `Warehouse First`, `Include/Exclude Delmar items`) directly inside the control strip.
- Completely removed noisy repetitive explanatory paragraphs and wordy status lists.

### 2. Dedicated Red Alarm Notification
- The **Red** visual style is strictly reserved for high-priority operational alarms:
  - Triggered exclusively when items compete for the same Delmar order/item pool.
  - Summarizes affected row numbers, sequential priority order, and automatic warehouse rerouting without clutter.

### 3. Dedicated Orange/Amber Variance Notice
- Streamlined variance alert in warm amber/orange:
  - Shows when requested delivery bars exceed Delmar stock in a concise, single-line notice.

---

## Verification & Deployment
- **Pre-Build Verification:** Clean build with `npm run build` (0 errors).
- **Firebase Hosting:** Deployed to `https://fawterx.web.app`.
- **Git Commit:** Committed and pushed to remote repositories (GitHub & Render).
