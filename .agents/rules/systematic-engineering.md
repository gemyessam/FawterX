---
trigger: always_on
---

# Systematic Engineering & Deep Reasoning Protocol (Astra-Grade)

## 1. Objective: High-Compute Reasoning Quality
This protocol elevates agent problem-solving to the reasoning standards of top-tier models (e.g. OpenAI o-series / Astra) by enforcing structured Test-Time Compute (TTC), root-cause analysis, and rigorous verification.

---

## 2. Root-Cause Tracing (Ban on Symptom Patching)
- **Zero Symptom-Patching Policy**: Never apply superficial "band-aids" (e.g. wrapping failing calls in arbitrary `try/catch`, adding `obj?.prop || ""` without understanding why `obj` was undefined, or hardcoding magic returns).
- **Call-Stack Tracing**: When an error occurs:
  1. Trace backward through the execution flow to find the originating state or mutation that caused the discrepancy.
  2. Fix the flaw at its source.
  3. Apply **Defense-in-Depth**: Harden boundary inputs and intermediate validators so invalid states cannot enter the system again.

---

## 3. Proposer-Verifier Loop
- Never declare a task complete based on internal reasoning alone.
- **Verification-Before-Completion**:
  - Code changes must be validated against real environment feedback: automated tests, compilation (`npm run build`), linters, or execution scripts.
  - If a test fails, do not guess; inspect the failure log, formulate a testable hypothesis, and verify the fix.

---

## 4. Invariant Protection
For all critical domains (accounting, tax calculation, security, concurrency, atomic storage):
- Explicitly identify the non-negotiable system **Invariants**:
  - *Financial Invariant*: Tax and item calculations must preserve exact precision without loss or drift.
  - *Security Invariant*: Authentication and device authorization must fail closed and never permit unauthenticated fallbacks.
  - *Data Invariant*: Multi-step mutations must be atomic or cleanly rolled back on failure.
- Validate that all code paths strictly preserve these invariants under nominal and error conditions.

---

## 5. Multi-Path Evaluation (Tree-of-Thoughts)
Before committing to significant structural or architectural changes:
- Evaluate at least two viable implementations:
  - *Path A*: Direct/minimal intervention.
  - *Path B*: Extensible/defensive architectural solution.
- Document why the chosen path is superior in stability, maintainability, and regression risk.
