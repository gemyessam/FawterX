---
trigger: always_on
---

# Antigravity → Codex Token-Efficient Review Agreement

## 1. Core Principle
Antigravity diagnoses, plans, implements, tests, and fixes. Codex reviews and renders decisions (`PLAN_APPROVED`, `REVIEW_PASSED`, `CHANGES_REQUESTED`, `BLOCKED`) without implementing code.
To maximize token efficiency and minimize redundant reasoning cycles, both agents strictly follow the token-efficient review policy below.

## 2. Assessment Before Dispatch
- Conduct all diagnosis and root-cause analysis before dispatching to Codex. Never send open-ended discovery tasks.
- Send only concise conclusions: Problem, Root Cause, Impact, Scope, Proposed Fix, Reproduction Evidence, Verdict, and Targeted Question.
- Do NOT send internal thought chain dumps, trial-and-error logs, or lengthy conversational narratives.

## 3. Concise Packaging & External Artifacts
- Single cohesive request and single decision per dispatch.
- Brief length target: **120–250 words** for new requests, and **50–120 words** for follow-ups (`FIX`).
- Keep briefs outside the application tree (e.g. `C:\Users\GeMy\.codex\reviews\FawterX\<run>\`).
- Do NOT inline full file contents or large diffs into the brief when files exist on the same local filesystem. Send absolute file paths and output diff files (e.g. `diff.patch`).
- Clearly state HEAD, baseline, and untracked files.

## 4. Explicit Model & Effort Selection (gpt-6-astra)
Always pass `--model gpt-6-astra` and explicitly select `--effort` based on the review complexity:
- **`--effort low`**: Minor/local changes, UI/CSS tweaks, display formatting, text changes, or straightforward follow-up fixes previously understood.
- **`--effort medium`**: Multi-layer logic, standard API endpoints, input validation, parser modifications, component refactoring.
- **`--effort high`**: Security/permissions, authentication/authorization, encryption, digital signing, concurrency, accounting/financial logic, stock atomicity.

Command pattern:
```powershell
node 'C:/Users/GeMy/.gemini/antigravity/skills/codex-delegate/scripts/relay.mjs' --brief '<absolute-brief-path>' --cd 'C:/Users/GeMy/.gemini/antigravity/scratch/FawterX' --read-only --ignore-user-config --model gpt-6-astra --effort <low|medium|high> --out-dir '<unique-output-directory>' --timeout 20m
```

## 5. Mandatory Dispatch Template
All briefs sent to Codex MUST follow this exact format:

```text
TYPE: PLAN | DIFF | FIX
ID: <TASK-ID>
REVIEWER: gpt-6-astra | EFFORT: low/medium/high | WHY: <One-line rationale for effort level>
ASK: <Specific question or approval sought>
STATE: <Project root + HEAD + tracked/untracked baseline>
ASSESSMENT: <Trigger, root cause with evidence, impact, max 3 lines>
CHANGE: <Proposed fix or implemented changes, typically 3 bullet points>
FILES: <Absolute paths to modified/new files and relevant function names>
EVIDENCE: <Test commands, exit codes, pass/fail counts, artifact log paths>
UNKNOWN: <Unverified assumptions or limitations, omit if none>
ARTIFACTS: <Absolute paths to diff.patch, check logs, or reference briefs>
```

In `FIX` mode, omit settled background context and focus strictly on:
`R1: <Finding> -> <Fix location> -> <Verification evidence>`
