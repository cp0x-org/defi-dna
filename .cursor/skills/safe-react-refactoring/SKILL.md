---
name: safe-react-refactoring
description: Safely refactor existing React and TypeScript code in small steps while preserving behavior. Use after reviewing the architecture and agreeing on a specific improvement.
---

# Safe React refactoring

## Step 1: Define the change

- State the exact problem being solved.
- Identify the affected modules and their callers.
- Describe observable behavior that must remain unchanged.
- Determine which checks can verify correctness.

If the proposed scope is broad or ambiguous, stop and propose a smaller change.

## Step 2: Plan

Present a short plan containing:

- Files to change.
- Responsibility changes, if any.
- Risks and compatibility concerns.
- Verification steps.

For architectural or multi-file refactors, wait for explicit user approval before editing.

## Step 3: Refactor

- Work on one cohesive concern at a time.
- Preserve public interfaces and route behavior.
- Keep domain logic explicit and easy to test.
- Avoid speculative abstractions and unnecessary dependencies.
- Do not mix feature work with structural cleanup.
- Do not suppress TypeScript errors to make the result appear correct.

## Step 4: Verify

- Run the available build, type-check, lint, and relevant tests.
- If a check is missing, report that it was not performed.
- Review the final diff for accidental changes.
- Inspect affected routes and data flows.
- Do not claim runtime behavior was verified if only compilation was checked.

## Step 5: Report

Explain:

- What changed and why.
- Which responsibilities are now clearer.
- Which behaviors were preserved.
- Which commands were run and their actual results.
- Remaining risks and recommended next steps.

Use clear language and briefly explain unfamiliar React concepts.
