# FawterX local redesign
User authorizes Codex planning and implementation. Local only; no commit or deployment.

## Objective and acceptance
Replace previous cosmetic concept with a cohesive redesigned application presentation. New login composition, real navigation markup, contextual topbar, restructured dashboard, styled invoice workspace, drafts/details, warehouse/admin, forms/tables/modals. Preserve business behavior, role access, routes and all action handlers. Arabic RTL and English LTR; mobile navigation; keyboard focus; reduced motion.

## Implementation order
1. Foundation: Lucide icons, GSAP scoped motion lifecycle, reusable page heading and navigation.
2. New login experience using existing authentication handlers.
3. Rebuild dashboard composition with real statistics and existing upload gate; no fabricated chart/data.
4. Recompose remaining page headings and apply consistent form/table/workflow surfaces.
5. Verify frontend build and git diff checks. User handles visual inspection per AGENTS.md.

## Stack and commands
React 18/Vite; existing GSAP; Lucide React. Build: npm --prefix frontend run build. Dev: npm --prefix frontend run dev -- --host 127.0.0.1 --port 3000 --strictPort.

## Structure and style
Reusable presentation in frontend/src/components; motion hooks in frontend/src/hooks; system CSS frontend/src/workspace-design.css. Bilingual presentational props, existing two-space React conventions. Example: <PageHeading eyebrow="WORKSPACE" title={lang === 'ar' ? 'لوحة التحكم' : 'Dashboard'} />.

## Verification and boundaries
No browser automation. No production writes, real credentials, backend edits, financial/auth logic changes, release/version bump. CLI build validates bundling; git diff --check checks patch hygiene. Animation cleanup on unmount and media change. Reduced motion disables decorative animation. No tests mirroring static markup; focused pure logic tests if new logic warrants them. Rollback limited to redesigned frontend files, preserve unrelated edits.

## References
https://ui.shadcn.com/blocks/sidebar (layout reference only)
https://gsap.com/docs/v3/GSAP/gsap.matchMedia()/ (responsive motion and cleanup)
https://lucide.dev/guide/react (SVG icon system)
