---
name: computer-use-and-automation
description: >-
  Master computer operations, Windows PowerShell automation, system monitoring,
  fast browser automation (Playwright/Browser-Use/Agent-Browser patterns), and tool workflows.
  Use when the user requests executing computer tasks, desktop/browser actions, or OS-level automation.
---

# Computer Use & Fast System Automation Skill

A modern runbook for high-speed, reliable computer operations, operating system automation, and browser control based on **`browser-use`**, **`agent-browser`**, and **Playwright** architectures.

---

## 1. The Core Paradigm: Speed, Reliability & Anti-Patterns

### ❌ The Anti-Pattern: Micro-Pixel Clicking
- **What goes wrong**: Taking a full-page screenshot $\rightarrow$ using vision to guess pixel coordinates $(X, Y)$ $\rightarrow$ clicking $\rightarrow$ waiting 10 seconds $\rightarrow$ taking another screenshot.
- **Why it fails**: Doing 20 micro-actions takes 5–7 minutes, burns thousands of vision tokens, risks context disconnections (CDP timeouts), and is fragile.

### ✅ The Fast Agent Paradigm (Modern 2026 Standards)
1. **Accessibility-Tree & Element-Index Targeting (`@eN`)**:
   - Always target elements by DOM IDs, CSS selectors, ARIA roles, or accessibility tree indices rather than guessing raw $(X, Y)$ pixel coordinates.
2. **Batch Interaction over Micro-Steps**:
   - For sequential actions (typing sentences, form entries, or rapid keypresses), dispatch keyboard event sequences or batch inputs in a single continuous instruction rather than pausing between every character.
3. **Pragmatic Direct Execution**:
   - If an automation task requires high precision or rapid execution, use a fast deterministic Node.js or Python automation script via `run_command` (executes in 200ms with zero vision overhead).

---

## 2. Fast Browser Automation Principles

### A. Subagent Dispatch Guidelines
When delegating tasks to `browser_subagent`:
- **Instruct Element & Keyboard Priority**: Explicitly tell the subagent to use DOM element targeting, keyboard shortcuts, and form fills instead of blind pixel clicking.
- **Avoid Single-Stroke Ping-Pong**: Define clear multi-action sequences (e.g. "type entire text, press Tab, type password, press Enter") in one continuous flow.
- **Verification by Post-Condition**: Verify actions by checking state changes (URL changed, modal appeared, alert text present) rather than taking redundant full-viewport screenshots between micro-actions.

### B. Lightweight Scripting Fallback (Playwright / Puppeteer / CDP)
For complex web workflows:
- Spin up a self-contained Node/Python script that drives the browser directly.
- Benefits: 100x faster, zero vision hallucination, precise network interception, deterministic results.

---

## 3. Windows Operating System & PowerShell Mastery

### A. Process & Service Management
- **High-Resource Processes**:
  ```powershell
  Get-Process | Where-Object { $_.CPU -gt 5 } | Select-Object -First 10 ProcessName, Id, CPU, WorkingSet64
  ```
- **Port & Network Inspection**:
  Check what process is occupying a port (e.g. 3000, 5000, 8080):
  ```powershell
  Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue | Select-Object LocalAddress, LocalPort, OwningProcess, State
  ```
- **Force-Kill Unresponsive Processes**:
  ```powershell
  Stop-Process -Id <PID> -Force
  ```

### B. Environment & System Health
- Environment Variables:
  ```powershell
  Get-ChildItem Env: | Select-Object Name, Value
  ```
- Disk Space:
  ```powershell
  Get-PSDrive -PSProvider FileSystem | Select-Object Name, Used, Free
  ```

### C. Background Daemons & Timers
- Launch persistent servers using `run_command` with `IsDaemon: true`.
- Track status and send inputs via `manage_task` (`status`, `send_input`, `kill`).
- Use `schedule` for delayed notifications or periodic cron health checks.

---

## 4. Safety & Destructive Action Boundaries

1. **Non-Destructive by Default**: Never execute `Remove-Item -Recurse`, `git reset --hard`, or drop database records without explicit user confirmation.
2. **Dry-Run Inspection**: For bulk file operations or migrations, inspect the candidate list first.
3. **Workspace Boundary**: Never touch files outside the authorized workspace unless explicitly requested.
