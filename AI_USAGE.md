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

### Entry 6 — First real use case: RegisterUserUseCase with fakes-based tests

**Date:** 2026-07-05
**Tool:** Claude Opus 4.7
**Task:** Implement the first application service (`RegisterUserUseCase`) that orchestrates the domain and every outbound port. Prove that the hexagonal design pays off by testing the use case with hand-written fakes instead of mocks.

**Prompt (paraphrased):**
> Guide me through writing `RegisterUserUseCase` that: (1) receives a command with email, password, displayName; (2) enforces email uniqueness via `IUserRepository`; (3) hashes the password via `IPasswordHasher`; (4) constructs a `User` with an id from `IIdGenerator` and a timestamp from `IClock`; (5) persists the user; (6) issues and returns an `AuthToken` from `ITokenService`. Then write unit tests using in-memory fakes for every port, not jest mocks.

**Result:**
- `src/application/usecases/auth/register-user.command.ts`: input DTO (plain data).
- `src/application/usecases/auth/register-user.usecase.ts`: the application service, depending on five interfaces via constructor injection.
- `src/application/ports/out/clock.port.ts`: `IClock` for deterministic timestamps under test.
- `src/application/ports/out/id-generator.port.ts`: `IIdGenerator` for deterministic ids under test.
- `test/application/usecases/auth/register-user.usecase.spec.ts`: 11 tests grouped in three concerns:
  - happy path (persistence, token issuance, hashing verification, injected clock, injected id)
  - business rule: email uniqueness (including case-insensitivity thanks to the `Email` VO)
  - input validation delegated to domain (invalid email format, empty display name)
- 100% coverage on the use case file.

**Modifications made by the developer:**
- Initial version of the `FakePasswordHasher` produced a "hash" that literally contained the plaintext (`hashed:${plaintext}:padding`). One test correctly caught this by asserting that the stored hash must not contain the plaintext. Fixed the fake to base64-encode the plaintext, which mirrors a real hasher's property of irreversibility at the string level.
- Chose to write the fake `FakePasswordHasher` deterministically rather than using `jest.fn()` with hard-coded returns. Rationale: a hand-written fake is a real object with real behavior; a mock is a scripted actor. Fakes catch integration bugs that mocks hide.
- Chose to inject `IIdGenerator` and `IClock` from day one instead of calling `crypto.randomUUID()` and `new Date()` inline. Rationale: the extra port cost is minimal, and it removes all non-determinism from the tests.

**Lessons learned:**
- The hexagonal architecture pays off exactly at this moment: writing the use case felt like plugging cables into an already-designed board. Every dependency was a named interface, every fake was a simple class, and every test asserted a behavior rather than an implementation detail.
- Writing a fake that is too naive (like the initial `FakePasswordHasher`) produces tests that pass against the fake but would fail against a real implementation. The correct discipline is to make the fake honor the essential properties of the real thing, even if it does not honor the incidental ones.
- Constructor injection with five ports may look verbose, but it makes the dependencies explicit and audit-friendly. When defending the design, the constructor signature *is* the documentation of what the use case needs.

---

### Entry 7 — Second use case: LoginUseCase with security-first error handling

**Date:** 2026-07-05
**Tool:** Claude Opus 4.7
**Task:** Implement `LoginUseCase` alongside `RegisterUserUseCase`. Understand and defend the decision to use a single generic error message for all authentication failure paths.

**Prompt (paraphrased):**
> Guide me through writing `LoginUseCase` that: (1) receives a command with email and password; (2) looks up the user by email; (3) verifies the password with `IPasswordHasher.verify`; (4) issues an `AuthToken` on success. Explain why the same error message should be used for unknown email, wrong password, and invalid email format, and add a test that specifically enforces this security property.

**Result:**
- `src/application/usecases/auth/login.command.ts`: input DTO with email and password.
- `src/application/usecases/auth/login.usecase.ts`: the application service, depending on three interfaces. All failure paths throw a single "Invalid credentials" error. The `new Email(...)` construction is wrapped in try/catch to normalize the error surface.
- `test/application/usecases/auth/login.usecase.spec.ts`: 8 tests grouped into three concerns:
  - happy path (token issuance, correct user id, case-insensitive email match)
  - failure paths (unknown email, wrong password, malformed email, no token issued on failure)
  - security (explicit assertion that the error message is identical for unknown-email and wrong-password cases)

**Modifications made by the developer:**
- Accidentally pasted the login test code at the end of `register-user.usecase.spec.ts` on the first attempt, producing "Duplicate identifier" errors. Recovered by fully overwriting both spec files with clean content. Reinforced the habit of verifying `wc -l` on each file after edits, and checking that class/const identifiers appear only once.
- Kept the `try/catch` around `new Email(command.email)` even though it feels defensive: without it, an ill-formed email would leak the message "Invalid email format" and betray the fact that the validation stage rejected the input. Preserving a uniform error surface across all failure branches is a deliberate part of the security posture.

**Lessons learned:**
- Same message for "unknown email" and "wrong password" prevents user enumeration attacks. A caller cannot use the error text to determine whether an email is registered. This is a small but important detail that many production systems still get wrong.
- The security-property test (last block in the suite) locks the design decision in place. If a future contributor "improves" the message to be more descriptive, the test fails and forces a design conversation instead of a silent regression.
- Copy-pasting large blocks into the wrong file is a real risk when iterating quickly. `wc -l` and `git status` before each commit are cheap habits that catch these mistakes early.

---

### Entry 8 — First infrastructure adapter: BcryptPasswordHasher

**Date:** 2026-07-05
**Tool:** Claude Opus 4.7
**Task:** Implement the first infrastructure adapter — `BcryptPasswordHasher` — that adapts the `bcrypt` npm library to the `IPasswordHasher` outbound port. Understand and defend the choice of exercising real bcrypt in tests instead of mocking it.

**Prompt (paraphrased):**
> Guide me through building `BcryptPasswordHasher` in the infrastructure layer. It should implement `IPasswordHasher`, accept a configurable cost factor (rounds) with sensible validation, hash and verify passwords using the real bcrypt library, and be covered by tests that exercise bcrypt itself (not a mock). Explain the Adapter pattern applied here and why running real bcrypt with a low cost factor is preferable to mocking.

**Result:**
- `src/infrastructure/security/bcrypt-password-hasher.ts`: adapter implementing `IPasswordHasher`. Constructor validates the rounds parameter (integer in 4..15). `hash` rejects empty plaintext; `verify` returns `false` for empty plaintext without throwing.
- `test/infrastructure/security/bcrypt-password-hasher.spec.ts`: 12 tests grouped by concern:
  - construction (valid range, below min, above max, non-integer)
  - hash (returns PasswordHash VO, no plaintext leakage, different hash per call due to salt, empty plaintext rejected)
  - verify (correct password, wrong password, empty plaintext)
  - round trip (hash then verify immediately)
- 100% coverage on the adapter.

**Modifications made by the developer:**
- Chose to exercise real bcrypt with cost factor 4 instead of mocking the library. Rationale: a mock cannot fail; real bcrypt with rounds=4 still runs in milliseconds and provides genuine confidence that our adapter maps to the library correctly.
- Made `verify` tolerate an empty plaintext by returning `false` instead of throwing. Rationale: an empty password submitted from an HTTP request is a normal failed login, not a programming error.
- Restricted the rounds range to 4..15. Below 4 is insecure


### Entry 9 — Three infrastructure adapters: SystemClock, UuidGenerator, JwtTokenService

**Date:** 2026-07-05
**Tool:** Claude Opus 4.7
**Task:** Implement the remaining "simple" infrastructure adapters that the application layer needs before the API can be wired up: a real system clock, a UUID generator, and a JWT-based token service. Ensure each adapter is exercised against its real underlying dependency instead of a mock.

**Prompt (paraphrased):**
> Guide me through building three infrastructure adapters together: `SystemClock` implementing `IClock` (returns `new Date()`), `UuidGenerator` implementing `IIdGenerator` (uses `node:crypto.randomUUID()`), and `JwtTokenService` implementing `ITokenService` (uses `jsonwebtoken` with HS256). Discuss why the algorithm should be explicit on both signing and verification, and why every token verification failure should share the same generic message.

**Result:**
- `src/infrastructure/system/system-clock.ts`: trivial adapter over `new Date()`.
- `src/infrastructure/system/uuid-generator.ts`: adapter over Node's `randomUUID()`, no external dependency.
- `src/infrastructure/security/jwt-token-service.ts`: adapter over `jsonwebtoken`. Enforces HS256 explicitly on sign and verify, validates constructor inputs, and normalizes every verification failure into a single generic `Invalid token` error.
- Tests:
  - `test/infrastructure/system/system-clock.spec.ts`: 3 tests (returns Date, within realistic window, monotonic across calls).
  - `test/infrastructure/system/uuid-generator.spec.ts`: 3 tests (returns string, matches RFC 4122 v4 regex, unique per call).
  - `test/infrastructure/security/jwt-token-service.spec.ts`: 13 tests grouped by


## Entry 10 — Prisma setup + UserMapper

**Date:** 2026-07-05
**Tool:** Claude Opus 4.7 (via chat handoff)
**Task:** Integrate Prisma ORM with PostgreSQL and add a mapper to translate between the `User` domain aggregate and the persistence row.

### Prompt (paraphrased)
"Continue where we left off — set up Prisma with the User model and create the mapper between domain and persistence."

### Result
- Installed Prisma 6 (had to downgrade from Prisma 7.8.0, which introduced breaking config changes: `url` no longer allowed in `schema.prisma`, `PrismaClient` requires an adapter).
- Defined the `User` model in `prisma/schema.prisma` with `id`, `email` (unique), `passwordHash`, `displayName`, `createdAt`.
- Generated two migrations:
  - `init` — creates the `users` table.
  - `make_display_name_required` — removes the `NULL` constraint from `displayName` to enforce a domain invariant at the DB level.
- Added `src/infrastructure/persistence/user.mapper.ts` with two static methods:
  - `toDomain(row)` — rebuilds the `User` aggregate, wrapping the email string in `Email` and the hash in `PasswordHash`.
  - `toPersistence(user)` — flattens the aggregate into a plain row shape ready for Prisma.
- Added 12 unit tests covering both directions, round-trip integrity, and fail-fast behavior on invalid rows.

### Files affected
- `prisma/schema.prisma` (modified)
- `prisma/migrations/*` (new — 2 migrations)
- `prisma.config.ts` (already present)
- `package.json`, `package-lock.json` (Prisma 6 pin)
- `src/infrastructure/persistence/user.mapper.ts` (new)
- `test/infrastructure/persistence/user.mapper.spec.ts` (new, 12 tests)

**Coverage:** UserMapper at 100% statements/branches.
**Test count:** 108 passing across 11 suites (was 96 across 10).

### Modifications made by the developer
- Detected via TypeScript error that the schema had `displayName String?` while `UserProps` declared it as required — chose to align the DB to the domain (Option 1) rather than weaken the domain invariant.
- Verified the actual shape of `UserProps`, the getter names (`.value`), and the User constructor signature before writing the mapper, avoiding blind assumptions.
- Confirmed each migration with `psql arrowmaze -c "\d users"` before committing.
- Split the work into two atomic commits (Prisma setup + UserMapper) for a cleaner history.

### Lessons learned
- Recently released framework versions (Prisma 7 was 6 weeks old at the time) can silently break setup steps that used to be trivial. Downgrading is not "settling for less" — it's picking the version that matches the tutorials, docs, and community answers you'll actually consult.
- When domain and DB disagree on a constraint, the direction of resolution matters: in Clean Architecture, the DB adapts to the domain, not the other way around. Nullable columns backing non-nullable domain fields are a smell — they push validation to the read path and defeat fail-fast.
- Separating a mapper from the repository is not premature abstraction. It isolates two responsibilities (persistence vs. translation), lets each be tested in isolation, and gives a concrete SRP example for the defense.
- Round-trip tests (`toPersistence(toDomain(x)) === x`) are the cheapest way to catch information loss in a mapper, and they double as a proof that both directions stay in sync as the model evolves.



## Entry 11 — PrismaService and PostgresUserRepository

**Date:** 2026-07-05
**Tool:** Claude Opus 4.7
**Task:** Wire Prisma into the infrastructure layer through a lifecycle-aware service and a repository adapter that implements the `IUserRepository` port.

### Prompt (paraphrased)
"Add the PrismaService with lifecycle hooks and the PostgresUserRepository that implements the outbound port."

### Result
- Added `PrismaService` extending `PrismaClient` and implementing `OnModuleInit` / `OnModuleDestroy` so the connection pool follows the Nest module lifecycle.
- Added `PostgresUserRepository` implementing `IUserRepository`:
  - `findById` and `findByEmail` use `findUnique` and delegate reconstruction to `UserMapper.toDomain`.
  - `save` uses Prisma's `upsert` to honor the port contract ("insert or update at the implementation's discretion") while omitting `createdAt` from the update branch to keep it immutable.
- No unit tests written for either file; rationale documented in the commit message and reinforced below.

### Files affected
- `src/infrastructure/persistence/prisma.service.ts` (new)
- `src/infrastructure/persistence/postgres-user.repository.ts` (new)

**Test count:** unchanged at 108 passing across 11 suites (integration tests come in block 9.3).

### Modifications made by the developer
- Verified the exact shape of `IUserRepository` before writing the adapter, confirming the method names, argument types (`string` vs `Email` VO), and return types.
- Chose `upsert` over exposing `create`/`update` separately, so the application layer never has to ask "does this user exist yet?" before saving.
- Explicitly omitted `createdAt` from the `update` payload so the repository enforces the invariant that creation time is immutable, even if a future domain change accidentally exposed it as mutable.
- Skipped unit tests for both files deliberately — the deferral is a design choice, not an omission.

### Lessons learned
- Some code genuinely does not deserve unit tests. `PrismaService` is a two-line lifecycle wrapper; a mocked test would only prove that Jest can call methods on a stub. `PostgresUserRepository` is thin glue that only makes sense when exercised against a real query engine. Mocking Prisma to "cover" it would test the mock, not the code. Both files will be exercised by integration tests, which is where their behavior actually lives.
- Deciding *what not to test* is as much a design skill as deciding what to test. Recognizing it explicitly (and defending it) is stronger than blindly chasing 100% coverage with hollow tests.
- Keeping the mapper separate from the repository paid off: this adapter is ~30 lines of readable query code because all the translation logic lives elsewhere. SRP in action.
- Prisma's `upsert` is the natural fit for a repository contract that says "insert or update, don't care which". Choosing it over exposing both operations preserves the port's abstraction.



## Entry 12 — Integration tests against real PostgreSQL

**Date:** 2026-07-05
**Tool:** Claude Opus 4.7
**Task:** Set up a separate test database, isolate integration tests from the dev environment, and prove that `PostgresUserRepository` works against real PostgreSQL.

### Prompt (paraphrased)
"Set up integration testing for the repository against a real Postgres database, following the same spirit we've applied with bcrypt and JWT (real dependencies, no mocks)."

### Result
- Created a dedicated `arrowmaze_test` PostgreSQL database and applied the existing Prisma migrations to it via `DATABASE_URL=... npx prisma migrate deploy`.
- Added `.env.test` with a distinct connection string; extended `.gitignore` with `.env.*` so it cannot leak.
- Installed `dotenv` as a direct devDependency (previously only transitive through Prisma) and added `test/jest-integration.setup.ts` that loads `.env.test` before any test module runs.
- Added a defense-in-depth guard: the setup file refuses to run tests unless `DATABASE_URL` explicitly points to `arrowmaze_test`. This prevents catastrophic accidents where a misconfigured env would truncate the dev database.
- Added `test/jest-integration.json` with a separate `.integration-spec.ts` regex and `--runInBand`, since integration tests share state (the DB) and cannot run in parallel.
- Added `npm run test:integration` script, keeping unit tests (`npm test`) fast and free of external dependencies.
- Created a reusable `DatabaseCleaner` helper (`test/infrastructure/helpers/`) that truncates all project-owned tables between tests using `TRUNCATE ... RESTART IDENTITY CASCADE`.
- Wrote 9 integration tests for `PostgresUserRepository`:
  - `findById` — returns `null` when missing, returns `User` when present.
  - `findByEmail` — same two paths.
  - `save (insert)` — persists a new user; persists multiple users with distinct emails.
  - `save (update)` — updates mutable fields; refuses to overwrite `createdAt` even if the incoming aggregate carries a different value (immutability invariant enforced by the adapter itself).
  - `round-trip integrity` — a full save + read cycle preserves every field, including value objects.

### Files affected
- `.gitignore` (added `.env.*` pattern)
- `.env.test` (new, git-ignored)
- `package.json`, `package-lock.json` (dotenv devDependency + `test:integration` script)
- `test/jest-integration.json` (new)
- `test/jest-integration.setup.ts` (new)
- `test/infrastructure/helpers/database-cleaner.ts` (new)
- `test/infrastructure/persistence/postgres-user.repository.integration-spec.ts` (new, 9 tests)

**Test counts:**
- Unit tests: 108 passing across 11 suites (unchanged).
- Integration tests: 9 passing across 1 suite.

### Modifications made by the developer
- Verified the existence of `arrowmaze_test` before recreating it, catching a wasted step early.
- Diagnosed a `psql -l` failure as a client/server version mismatch (`daticulocale` column) and worked around it with a direct query to `pg_database` instead of blindly upgrading tools mid-task.
- Chose to keep `DatabaseCleaner` one level above `persistence/` because the helper is not persistence-specific — future test suites (games, sessions) will reuse it. This was decided intentionally after noticing the file had been placed there by accident.
- Split the work into two atomic commits (test infrastructure vs. the first test using it) so the reusable scaffolding is clearly separated from its first application in the history.

### Lessons learned
- A test that talks to a real database is only trustworthy if that database is isolated. Sharing the dev DB would either corrupt development data or force tests to be non-deterministic. A separate `arrowmaze_test` DB is the equivalent of a clean room — the same discipline that unit tests get for free with mocks, extended to integration tests.
- Environment guards belong in the test setup, not in a README. A programmer will read the setup file (because it fails). A programmer may or may not read the README. The explicit `throw` if `DATABASE_URL` does not contain `arrowmaze_test` catches the class of bugs where "it worked on my machine because my `.env.test` happened to be right".
- Splitting Jest into two configs (unit vs. integration) preserves the fast feedback loop of unit tests. Merging them would drag every commit through a database roundtrip, which erodes the habit of running tests often.
- Deciding not to test `PrismaService` and `PostgresUserRepository` in isolation (entry 11) paid off here: these integration tests exercise exactly the code that has no unit tests, and they exercise it against the same engine that will run in production. Coverage without meaning would have been a distraction; this is coverage that would actually catch a real bug.
- The "small accidental move" of `DatabaseCleaner` to `test/infrastructure/helpers/` turned out to be the correct structural decision. Noticing it before committing is what stopped it from becoming technical debt disguised as a working test.




## Critical evaluation (in progress)

This section will be updated at the end of the project with:
- Approximate percentage of code with AI assistance.
- Notable cases where AI produced incorrect or suboptimal output.
- Team reflection on the impact of AI on productivity and code quality.