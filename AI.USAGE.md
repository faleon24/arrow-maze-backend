# AI Usage Documentation

This document tracks the use of AI tools throughout the development of the Arrow Maze backend. It follows the transparency requirements of Section 7 of the project specification.

## Tools used

| Tool | Version / Model | Role |
|------|----------------|------|
| Claude (Anthropic) | Claude Opus 4.7| Architecture guidance, code review, pair-programming assistant, test design mentor |

## Guiding principles

- The team is fully responsible for every line of code in the repository, regardless of whether it was AI-assisted or written from scratch.
- AI is used as a mentor and reviewer, not as an autonomous code generator. Every AI-produced fragment is read, understood, adapted to the project's conventions, and covered by unit tests written by the developer.
- Prompts never contain credentials, personal data, or API keys.
- Architectural decisions (hexagonal architecture, no enums, no DDD tactical patterns) were taken by the team based on the professor's guidance, not delegated to the AI.

---

## Task log

### Entry 1 — Project setup and hexagonal folder structure

**Date:** 2026-07-03
**Tool:** Claude Opus 4.7
**Task:** Bootstrap the NestJS backend with a hexagonal folder structure aligned to the project's UML.

**Prompt (paraphrased):**
> I need to start a NestJS project from scratch that mirrors the hexagonal architecture in my UML. Guide me through creating the folder structure (domain, application, infrastructure, api, shared), configuring TypeScript strict mode, installing Prisma with PostgreSQL, setting up class-validator for DTOs, and configuring environment variables. Explain the reasoning behind each decision.

**Result:**
- Folder structure created under `src/`: `domain/models`, `domain/services`, `application/ports/in`, `application/ports/out`, `application/usecases`, `application/aspects`, `infrastructure/persistence`, `infrastructure/security`, `infrastructure/messaging`, `infrastructure/system`, `api/controllers`, `api/middleware`, `api/dto`, `shared`.
- `main.ts` bootstrap with global `/api` prefix and global `ValidationPipe`.
- `app.module.ts` as empty root module (to be populated as we add features).
- `.env` with `DATABASE_URL`, `PORT`, `JWT_SECRET`, `JWT_EXPIRES_IN`.
- Prisma initialized with PostgreSQL provider.
- `dist/` excluded from repo (found in a follow-up commit).

**Modifications made by the developer:**
- Adjusted the `DATABASE_URL` to match the local PostgreSQL setup (`alejandroleon@localhost:5432/arrowmaze`).
- Cleaned up the `.gitignore` to exclude editor artifacts (`.deno_lsp`, `.DS_Store`) that were specific to the local machine.
- Verified compilation and boot manually before committing.

**Lessons learned:**
- NestJS default templates ship with `AppController` and `AppService` "Hello World" scaffolding that don't fit a hexagonal layout. Removing them early avoids confusion later.
- Prisma's `db pull` on an empty database returns error P4001; this is expected and not a real error — it just means "no tables to introspect".

---

### Entry 2 — User domain entity with unit tests

**Date:** 2026-07-03
**Tool:** Claude Opus 4.7
**Task:** Implement the `User` entity in the domain layer with full unit test coverage in AAA format, following the naming convention `should_[result]_when_[condition]` required by Section 3.5 of the specification.

**Prompt (paraphrased):**
> Based on the UML, create the `User` entity with `id`, `email`, `passwordHash`, `displayName`, `createdAt`. Enforce business rules: valid email format, non-empty display name (also rejecting whitespace-only), non-empty password hash. Include a `rename` behavior. Explain SRP application. Then write unit tests in AAA format with descriptive names.

**Result:**
- `src/domain/models/user.ts`: class with private fields, getters, constructor-level validation, and a `rename` method that re-validates.
- `test/domain/models/user.spec.ts`: 15 unit tests organized into three `describe` blocks (`creation`, `rename`, `encapsulation`).
- 100% coverage on `src/domain/models/user.ts` (statements, branches, functions, lines).

**Modifications made by the developer:**
- The initial encapsulation test assumed silent failure when mutating a getter-only property. In practice, Node.js in strict mode throws a `TypeError`. Refactored the test into two separate cases: one asserting the throw, one asserting that the original value survives the attempt. Both are more informative than the original.
- Reviewed the email regex; understood its limitations (does not cover full RFC 5322) and accepted the trade-off for an academic project.

**Lessons learned:**
- Placing validation in the constructor makes it impossible to construct an invalid `User`. This is "fail-fast" and simplifies every downstream consumer — no need to defensively re-check.
- Getters-without-setters is a strong encapsulation mechanism in TypeScript: it prevents mutation at compile time (via TypeScript errors) *and* at runtime (via `TypeError`).
- AAA structure with `// Arrange`, `// Act`, `// Assert` comments makes each test's intent obvious to anyone reading the file — including the professor during defense.

---

## Critical evaluation (in progress)

This section will be updated at the end of the project with:
- Approximate percentage of code with AI assistance.
- Notable cases where AI produced incorrect or suboptimal output.
- Team reflection on the impact of AI on productivity and code quality.