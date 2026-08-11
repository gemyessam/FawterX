# FawterX Release Log - Version v2.27.2

**Release Date:** August 11, 2026  
**Environment:** Production (`https://fawterx.web.app`)  
**Repository Branch:** `main`

---

## 🌟 Overview & Key Updates

Version `v2.27.2` fixes an irritating UI behavior where navigating to an empty drafts list page triggered an erroneous toast notification (`فشل جلب المسودات`).

### Key Fixes
- **Drafts API Clean Handling:** Updated `Drafts.jsx` to gracefully default to an empty state (`[]`) without triggering error toast popups when zero recovery drafts exist in Firestore.
- **Improved UX:** Ensures clean, immediate rendering of the empty box state (`لا يوجد أي مسودات محفوظة حالياً.`).
