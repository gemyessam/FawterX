# Release Log — FawterX v2.27.11

**Date:** 2026-08-11  
**Type:** Critical Bug Fix  
**Scope:** Admin Panel Authentication & Diagnostics

---

## Problem

The Admin Panel was displaying empty data (KPIs showing `0`, users table empty) with the toast error `فشل تحميل لوحة الإدارة`, despite the backend working correctly when tested with the bypass token. The real browser session's Firebase token was failing authentication.

## Root Cause

Three interrelated issues:

1. **Stale token fallback** — `getCurrentAuthToken()` fell back to `localStorage.fawterx_id_token` when `auth.currentUser` was `null` during initial page load. After the security update, these stale tokens caused 401 errors on the backend.
2. **No auth readiness wait** — Firebase Auth had not yet resolved `currentUser` when admin API calls were fired, causing the function to skip the live user and use stale localStorage tokens.
3. **Silent error swallowing** — The AdminPanel only showed a generic toast on failure with no diagnostic info, making it impossible to know if the error was 401, 403, or 500.

## Changes

### Frontend (`api.js`)
- **Wait for Firebase auth readiness** — Added `auth.authStateReady()` call before checking `currentUser`
- **Force-refresh tokens** — Changed `getIdToken()` to `getIdToken(true)` to force fresh token after security changes
- **Remove stale fallback** — No longer falls back to `localStorage` token when user is not authenticated
- **401 response interceptor** — Automatically clears `fawterx_id_token` from localStorage on any 401 response
- **Added `getAdminWhoami()` API function**

### Backend (`admin.js`)
- **Added `/api/admin/whoami` endpoint** — Placed before `requireAdmin` middleware so it works even when admin check would fail. Returns the email, uid, and isAdmin status the backend resolves from the browser token.

### Frontend (`AdminPanel.jsx`)
- **Detailed diagnostic error card** — When stats/users both fail, automatically calls `/whoami` and displays:
  - HTTP status codes for stats and users APIs
  - Error messages from the backend
  - The actual email and isAdmin status from the token
  - A "Clear token & reload" button for quick recovery
- **Import `getAdminWhoami`** from api service

### Version Bump
- `package.json`: `2.27.10` → `2.27.11`
- `App.jsx`: All version display strings updated

## Deployment

- ✅ Frontend built successfully
- ✅ Firebase Hosting deployed: `https://fawterx.web.app`
- ✅ GitHub pushed → Render auto-deploy triggered

## Verification

After Render finishes deploying, open Admin Panel and verify:
1. KPI cards show actual user counts (not `0`)
2. Users table populates with 12 users
3. If still failing, the diagnostic card will show exactly why (401/403/email mismatch)
