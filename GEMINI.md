# FawterX working agreement

Read and follow `AGENTS.md` at this workspace root before planning or changing this project.
The user has assigned Antigravity implementation and Codex read-only review.
For complex, architectural, security, or tax-calculation tasks, send the plan to Codex and receive `PLAN_APPROVED` before editing, and `REVIEW_PASSED` before releasing. Routine and simple tasks are executed directly by Antigravity per user directive.
Use the installed codex-delegate relay with `--read-only` for Codex reviews.
Follow `ANTIGRAVITY_TOKEN_EFFICIENT_REVIEW_RULES.md`, `.agents/rules/token-efficient-review.md`, `.agents/rules/pragmatic-sdd.md`, `.agents/rules/systematic-engineering.md`, and `.agents/rules/no-browser.md` to enforce Astra-grade deep root-cause reasoning, invariant protection, on-disk ledgers, autonomous rulings, and strict prohibition on browser tools.
The detailed roles, commands, and review contract are in `AGENTS.md`.

## Strict Prohibition on Browser Tools (`browser_subagent`)
- **NEVER use `browser_subagent` or any automated browser tools.**
- Do NOT launch automated browser sessions, headless navigation, screenshot capture via browser, or video recording.
- All visual and UI testing is left exclusively to the USER in their own browser.
- All testing and verification must be conducted strictly via local terminal/CLI commands (`npm run build`, `npm test`).
- Zero internet bandwidth waste and zero system choking.



