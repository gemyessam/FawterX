# FawterX: Antigravity implements, Codex reviews

This is the user's explicit working agreement, established on 2026-09-07.
It takes precedence over generic delegation instructions that assign implementation or commits to Codex.

## Roles

- Antigravity proposes plans, implements approved changes, writes tests, and fixes review findings.
- Codex only reviews plans and changes, inspects files/diffs, and independently verifies results. Codex must not implement application changes, fix tests, commit, push, or deploy.
- Codex may write review reports and maintain the explicitly requested communication setup. Build/test output is permitted for verification; tests must not mutate production services or use real customer credentials.
- The user can change this agreement explicitly. Do not assume a generic request to continue changes these roles.
- **Task Complexity & Review Requirement (Updated per User Direction):**
  - **Simple & Routine Tasks:** UI tweaks, metadata/SEO tags, text changes, static assets, straightforward component formatting, and localized fixes are executed directly by Antigravity (plan, implement, test, and deploy) without requiring Codex review overhead.
  - **Complex & High-Risk Tasks:** Core architectural changes, complex tax/financial calculation logic, digital signing/security modules, and sensitive multi-layer backend refactoring require the full Codex review cycle (`PLAN_APPROVED` and `REVIEW_PASSED`).

## Required review cycle (For Complex Tasks)

1. Antigravity inspects the relevant current code and writes a concrete plan before changing application code. Include the task, reproduction/evidence, scope, files, proposed behavior, compatibility concerns, tests, and rollback approach where relevant.
2. Antigravity sends that plan to Codex for read-only review. Include the complete plan in the brief, the repository path, current HEAD and dirty-file baseline. Do not rely on either agent having the other conversation's history.
3. Codex returns `PLAN_APPROVED`, `CHANGES_REQUESTED`, or `BLOCKED`, with reasoning and any required corrections. Only an explicit `PLAN_APPROVED` for this plan permits implementation. Silence, a timeout, a failed relay, or a prior unrelated approval is not approval.
4. Antigravity implements only the approved scope, runs appropriate tests, and submits the actual diff plus its report. Scope changes go back for plan review.
5. Codex inspects the diff and independently reruns relevant local checks. Return `REVIEW_PASSED`, `CHANGES_REQUESTED`, or `BLOCKED`, naming the exact revision/diff reviewed, findings, verification evidence, and untested limitations.
6. Antigravity handles every required correction and resubmits. Never treat a successful build or the implementer's self-report alone as completed review.
7. Existing release/version/deployment instructions may run only after `REVIEW_PASSED`, within the user's release authorization. Antigravity owns those actions. Any subsequent code change needs another review. Communication setup and smoke checks are not application releases.

Review the current files, not stale handoff notes or historical release claims. Do not revert unrelated working-tree edits.

## Communication via delegate-skills

Upstream: https://github.com/amElnagdy/delegate-skills
Installed revision: b781ee2e23089630e2fbee1cfd6174afe4edeb76

- Codex -> Antigravity: `C:/Users/GeMy/.codex/skills/agy-delegate/scripts/relay.mjs`.
- Antigravity -> Codex: `C:/Users/GeMy/.gemini/antigravity/skills/codex-delegate/scripts/relay.mjs`.
- CLI copy: `C:/Users/GeMy/.gemini/antigravity-cli/skills/codex-delegate/scripts/relay.mjs`.
- Always pass `--read-only` when calling Codex, including resumed calls. Never dispatch Codex with the upstream default write sandbox for this project.
- Use `--read-only` when asking Antigravity for a plan. Implementation requires the approved plan and a subsequent scoped implementer brief.
- A relay starts a separate CLI conversation; it does not send to the already-open Codex desktop task or automatically monitor either app's chat.
- Continue the exact returned `threadId` / `conversationId` when applicable; avoid global `--resume-last` because unrelated sessions may exist.
- Do not create recursive delegation: a Codex review session reports its findings to its caller and never launches Antigravity from inside that review.
- Read the complete `result.json` and `finalMessage`. A nonzero exit, incomplete output, or empty response is not an approval.
- Keep briefs/results outside the application tree, e.g. `C:/Users/GeMy/.codex/reviews/FawterX/<unique-run>/`. Do not put API keys, tokens, or customer invoice contents in briefs.

Example review request in PowerShell (caller supplies an existing UTF-8 brief and a fresh output directory):

```powershell
node 'C:/Users/GeMy/.gemini/antigravity/skills/codex-delegate/scripts/relay.mjs' --brief '<absolute-brief-path>' --cd 'C:/Users/GeMy/.gemini/antigravity/scratch/FawterX' --read-only --ignore-user-config --out-dir '<unique-output-directory>' --timeout 20m
```

If `codex` or `agy` is absent from an existing terminal's PATH, restart that terminal after installation, or prepend its installed binary directory to this process's PATH. Do not change account credentials or bypass tool permissions.

## Verification commands

- Backend: `npm --prefix backend test -- --runInBand`.
- Frontend: `npm --prefix frontend run build`.
- Review `git status --short`, `git diff --stat`, and the complete relevant diff, including new files.
- Add task-specific verification where the existing tests do not cover the risk. Antigravity writes permanent regression tests; Codex reviews and runs them.
- Never exercise real ETA submissions, production Firestore writes, or USB signing as an incidental test.
