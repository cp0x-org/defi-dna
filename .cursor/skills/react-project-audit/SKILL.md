---
name: react-project-audit
description: Audit an existing React and TypeScript application for architecture, maintainability, duplication, and unnecessary complexity. Use before planning a refactor. Do not modify code during the audit.
---

# React project architecture audit

You are reviewing an existing application, not designing a new one.

## Procedure

1. Read package.json and the TypeScript configuration.
2. Identify the application entry point, router setup, major pages, shared components, hooks, and data modules.
3. Trace representative user flows through routes, components, state, and data access.
4. Inspect the existing @defi-dna/data package and determine which responsibilities it already owns.
5. Identify concrete examples of duplicated logic, mixed responsibilities, excessive coupling, difficult-to-follow state flows, and unsafe types.
6. Check whether components, hooks, and modules have clear responsibilities.
7. Distinguish actual problems from subjective preferences and harmless stylistic differences.
8. Propose a target architecture only after understanding the current architecture.
9. Rank recommendations by impact, confidence, risk, and estimated effort.

## Required output

- Current architecture overview.
- Important dependencies and data flows.
- Confirmed problems with file paths and code evidence.
- Recommended improvements, ordered by priority.
- Proposed directory structure, only if current organization warrants changes.
- A phased refactoring plan with small, verifiable steps.
- Checks needed to preserve behavior.

## Constraints

- Do not edit files, install packages, or change configuration.
- Do not recommend adopting a new framework or state manager without a concrete justification.
- Do not prescribe arbitrary component-size limits.
- Do not treat the absence of tests, TypeScript, or an abstraction as proof of a specific defect without inspecting the context.
- Prefer the smallest architectural change that resolves each demonstrated problem.
- Explain every major recommendation for a developer who is new to React.
