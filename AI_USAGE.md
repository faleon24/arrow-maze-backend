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

### Entry 3 — Email value object and User refactor

**Date:** 2026-07-03
**Tool:** Claude Opus 4.7
**Task:** Extract email validation into an `Email` value object and refactor `User` to depend on it. Understand and defend the trade-offs between passing a raw string vs. a constructed VO to the entity.

**Prompt (paraphrased):**
> Right now `User` validates emails inside its constructor. That duplicates logic and violates SRP. Guide me through creating an `Email` value object with format validation, normalization (lowercase + trim), structural equality, and immutability. Then refactor `User` to receive an `Email` instance. Explain the SRP/OCP improvement and update the tests accordingly.

**Result:**
- `src/domain/models/email.ts`: immutable class with normalization, validation, and structural equality via an `equals` method.
- `test/domain/models/email.spec.ts`: 14 tests grouped in `creation`, `normalization`, `equals`, `toString`. 93.75% coverage; the one uncovered line is a runtime type guard already enforced by TypeScript at compile time.
- `src/domain/models/user.ts`: refactored to receive an `Email` value object. Email format validation is fully delegated to the VO.
- `test/domain/models/user.spec.ts`: rewrote to build props via a factory function (`buildValidProps`) instead of a shared const, preventing cross-test contamination. Added a new `email delegation` group. 100% coverage on `user.ts`.

**Modifications made by the developer:**
- Chose Option A (pass a constructed `Email` to `User`) over Option B (pass a string and construct internally), after weighing verbosity vs. purity. Rationale: keeps `User` free of any knowledge about `Email` construction, which is the point of a value object.
- Kept the redundant runtime type guard in `Email` constructor (`typeof raw !== 'string'`) as a defensive measure at the JS runtime boundary, accepting that it will not be reachable from TypeScript callers.

**Lessons learned:**
- A well-placed value object drastically reduces the surface area of the entity that owns it. `User` went from validating regex + emptiness + format to a single `instanceof` check.
- Refactoring the entity broke the entity's tests but not the VO's tests — evidence that the tests are aligned with each class's responsibility. When SRP is respected in production code, it tends to appear naturally in the tests as well.
- Using a factory function `buildValidProps()` instead of a shared `const validProps` for test fixtures avoids subtle bugs where one test's mutation of the shared object silently affects the next test. It's slightly more verbose but far more robust.

---


### Entry 4 — PasswordHash value object and IPasswordHasher outbound port

**Date:** 2026-07-03
**Tool:** Claude Opus 4.7
**Task:** Introduce the first outbound port (`IPasswordHasher`) alongside a `PasswordHash` value object. Understand the distinction between representing data (VO) and declaring an external operation the application needs (port).

**Prompt (paraphrased):**
> Guide me through creating `PasswordHash` as a value object in the domain layer, and `IPasswordHasher` as an outbound port in the application layer. Explain why they belong in different layers, how this is Dependency Inversion in action, and refactor `User` to use `PasswordHash` instead of a raw string. Include a defensive `toString` that redacts the actual hash to avoid accidental logging.

**Result:**
- `src/domain/models/password-hash.ts`: immutable VO with basic structural validation (non-empty, minimum length of 20 chars to remain algorithm-agnostic), equality, and a redacted `toString`.
- `test/domain/models/password-hash.spec.ts`: 8 unit tests across creation, equality, and safe string representation.
- `src/application/ports/out/password-hasher.port.ts`: `IPasswordHasher` interface declaring async `hash` and `verify` operations. No implementation — that comes in the infrastructure layer.
- `src/domain/models/user.ts`: refactored to accept `PasswordHash` instead of a raw string.
- `test/domain/models/user.spec.ts`: updated to construct users with a `PasswordHash` VO and to include a new test case for the type check.

**Modifications made by the developer:**
- Chose a generic minimum length of 20 characters instead of coupling to bcrypt's 60-character format, so the VO stays algorithm-agnostic. If we switch from bcrypt to argon2 tomorrow, the VO does not need changes.
- Kept `toString` returning `'[PasswordHash]'` on purpose. Reviewed and understood that leaking a real hash into logs is a real production risk; the redacted marker is a cheap defense.

**Lessons learned:**
- A value object represents *a thing*; a port represents *a capability needed from outside*. Mixing the two in the same layer collapses the hexagonal boundary. Keeping them separate makes DIP visible in the file layout, not just in the code.
- Async `Promise<...>` on the port from day one avoids a costly refactor later. bcrypt/argon2 are always async in practice.
- `redacted toString` is a defensive engineering habit worth adopting proactively rather than after the first incident in production.

---

### Entry 5 — AuthToken value object and the remaining outbound ports (IUserRepository, ITokenService)

**Date:** 2026-07-03
**Tool:** Claude Opus 4.7
**Task:** Complete the set of ports and value objects required by the first real use case (`RegisterUserUseCase`). Understand why interfaces alone belong in the application layer and how they invert the direction of dependency between application and infrastructure.

**Prompt (paraphrased):**
> I need three artifacts before I can write my first use case: (1) an `AuthToken` value object in the domain, representing an issued token with expiration; (2) an `IUserRepository` outbound port declaring the persistence operations; (3) an `ITokenService` outbound port declaring token issuance and verification. Explain why the ports live in `application/ports/out` and not in the domain, and why interfaces do not require implementations at this stage.

**Result:**
- `src/domain/models/auth-token.ts`: immutable VO with value + expiration, an `isExpired(now)` method that accepts an explicit clock (for testability), and a redacted `toString` to prevent accidental log leaks.
- `test/domain/models/auth-token.spec.ts`: 9 unit tests across creation, expiration boundary conditions, and safe string representation.
- `src/application/ports/out/user-repository.port.ts`: `IUserRepository` interface with `findById`, `findByEmail`, and `save`. All async, all returning `null` (not throwing) when a lookup misses.
- `src/application/ports/out/token-service.port.ts`: `ITokenService` interface with `issue` and `verify`. `verify` returns the user id on success, throws on failure.

**Modifications made by the developer:**
- Chose to make `isExpired` accept `now` as a parameter rather than reading `Date.now()` internally. Rationale: it makes the check trivially testable without mocking global time, and mirrors how a clock port will inject `now` into use cases later.
- Chose `Promise<User | null>` over `Promise<User>` + throw for repository lookups. Rationale: "not found" is a normal outcome of a query, not an exception. Throwing would force every caller to write try/catch just to handle a common branch.

**Lessons learned:**
- Ports are declarations of *what the application needs from outside*. They do not describe *how*. That is why they cannot live in the domain (which is even more inward) and must not live in infrastructure (which is outward, the "how"). The application layer is the exact right place: it consumes them and lets external adapters fulfill them.
- Interfaces in TypeScript compile away, so they contribute zero runtime code. Test coverage reports show them as fully covered by default, which is technically correct: there is nothing to execute.
- Accepting `now: Date = new Date()` as a default parameter is a small pattern that pays off: production code stays terse, and tests get full control over time without touching globals.

---



## Critical evaluation (in progress)

This section will be updated at the end of the project with:
- Approximate percentage of code with AI assistance.
- Notable cases where AI produced incorrect or suboptimal output.
- Team reflection on the impact of AI on productivity and code quality.