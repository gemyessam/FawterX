# Release Logs & Agent On-Disk State Ledger Rule

## 1. Core Purpose: Machine Recall & Token Efficiency
To eliminate redundant full-codebase scans, protect context across compactions, and ensure smooth multi-agent collaboration (Antigravity & Codex):
- Every release log functions as an **On-Disk State Ledger**.
- Agents can read the most recent release logs in `release_logs/` to instantly reconstruct the system state, active business logic, and past architectural decisions without wasting tokens scanning dozens of source files.

---

## 2. Dedicated Directory Location
- **ALL** release logs must be strictly stored inside the dedicated repository directory:
  `release_logs/`
- **Naming Pattern:** `release_logs/RELEASE_LOG_v<VERSION>.md` (e.g. `release_logs/RELEASE_LOG_v2.27.72.md`).
- **NO** release logs may be written directly to the repository root.

---

## 3. Machine-Optimized Markdown Structure
Every release log MUST follow this exact, structured, high-signal template designed for rapid agent parsing:

```markdown
# FawterX Release Log - v<VERSION>

**Release Date:** YYYY-MM-DD
**Commit Hash:** <git-short-hash>
**Deployment Target:** Firebase Hosting (`https://fawterx.web.app`) & Render Backend Sync
**Domain / Scope:** <e.g. Warehouse / Coating / Stock Management / ETA Invoicing>

---

## 1. Problem Statement & Root Cause
- **Trigger / User Feedback:** <Concise summary of user report or feature request>
- **Root Cause / Technical Gap:** <Exact technical reason why the issue existed>

---

## 2. Established Invariants & Business Rulings
- **Invariant [ID/Name]:** <The non-negotiable rule established, e.g. "Zero-stock documents must be purged to deletedStock and never returned in active stock API">
- **Architectural Ruling:** <Decision made and why, eliminating ambiguity for future sessions>

---

## 3. Targeted Code Surface (Modified Files & Symbols)
- `path/to/file1.ext`:
  - `functionName1()`: <Exact mutation or logic added>
  - `functionName2()`: <Exact mutation or logic added>
- `path/to/file2.ext`:
  - `<Component / Element>`: <UI adjustment or event handler>

---

## 4. Verification Evidence & Quality Assurance
- **Frontend Unit Tests:** `<test command>` -> Passed (<X>/<X> tests)
- **Backend Test Suite:** `<test command>` -> Passed (<Y>/<Y> tests)
- **Production Build:** `npm --prefix frontend run build` -> 0 errors (<Z>s)
- **Deployments:** Firebase Hosting & GitHub push verified.

---

## 5. Agent Quick-Context (Compaction Recovery)
- **Active State:** <1-2 sentences on what future agents need to know when continuing from this version>
- **Known Boundaries:** <Any deliberately deferred work or untouched systems>
```

---

## 4. Maintenance & Archival
- Keep all historical logs inside `release_logs/`.
- Future sessions recovering from context truncation or investigating regressions must inspect `release_logs/` before performing any wide codebase exploration.
