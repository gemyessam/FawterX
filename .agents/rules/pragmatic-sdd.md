---
trigger: always_on
---

# Pragmatic Subagent-Driven Development (SDD) Rule

## 1. Core Operating Principle: Hybrid Execution
To balance engineering rigor with token and cost efficiency, FawterX enforces a hybrid execution model:
- **Routine & Simple Tasks** (UI tweaks, text formatting, localized fixes, SEO metadata): Executed directly and concisely by Antigravity without spawning subagents, multi-tier review overhead, or excessive briefs.
- **Complex, Security & Financial Tasks** (Tax algorithms, encryption, digital signing, atomic stock, multi-layer refactoring): Strictly follow this pragmatic SDD protocol with isolated briefs, on-disk ledgering, and independent review.

---

## 2. On-Disk State Ledger Protocol (Save Points)
Conversation memory does not survive context compaction. To guarantee continuity and eliminate token-wasting re-execution:
- Every structured multi-step plan MUST maintain a physical ledger file on disk (e.g., `audit-index.md` or `.agents/progress.md`).
- **Ledger Entries**: Each task must track:
  ```text
  - [x] Task <ID>: <Summary>
    - Commit: <git-short-hash>
    - Review: <PLAN_APPROVED / REVIEW_PASSED / VERIFIED>
    - Status: COMPLETE
  ```
- **Compaction Recovery**: Following context compaction or session resumption, the agent MUST inspect the ledger and `git log` first. Never re-execute tasks marked `COMPLETE` or verified by commit hashes.

---

## 3. Rulings Protocol (Decisions, Not Stalls)
A running plan must not halt for minor technical ambiguities or trivial preferences that can be deduced from the codebase or specification:
- The agent resolves technical conflicts autonomously and logs the decision in the task report or ledger:
  ```text
  Ruling: <What was decided> — <Engineering rationale> — <Rollback cost if wrong>
  ```
- **The Four Absolute Stop Conditions (Human Intervention Required)**:
  The agent must halt and request human instruction ONLY when encountering:
  1. Irreversible or destructive operations (data drops, migration rewrites, breaking backward compatibility).
  2. Security-sensitive actions (modifying secret keys, authentication bypasses, cert alterations).
  3. External side-effects outside the current workspace (pushing unverified commits to shared remotes, unauthorized production deploys).
  4. Complete specification contradiction where every forward path is pure guesswork.

---

## 4. Review Circuit Breaker (Anti-Token Bloat)
Review loops between Antigravity and Codex (or subagents) must never become infinite ping-pong discussions:
- **Maximum 3 Review Rounds (`R1`, `R2`, `R3`)**:
  - `R1`: Initial diff review and finding dispatch.
  - `R2`: Verification of addressed findings.
  - `R3`: Final targeted check.
- **Trip Condition**: If a review item remains unaligned after Round 3:
  - The circuit breaker **trips immediately**.
  - Do NOT generate Round 4.
  - Compile an **Arbitration Brief** presenting:
    `Disputed Finding -> Antigravity Rationale -> Codex Finding -> User Choice Required`.
  - Escalate to the human partner for the final architectural decision.

---

## 5. Pre-flight Conflict Scan
Before starting execution on any multi-task implementation plan:
- Perform a dependency and interface scan across all planned tasks.
- Identify any shared files, database schemas, or exported functions that one task modifies while another consumes.
- Resolve contract differences before writing implementation code.
