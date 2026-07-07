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

## Entry 13 — AppModule as the composition root

**Date:** 2026-07-06
**Tool:** Claude Opus 4.7
**Task:** Wire the whole application together in `AppModule` so Nest can resolve every use case and adapter through DI, and get the app booting cleanly for the first time.

### Prompt (paraphrased)
"Cable AppModule with providers so the app actually runs, without leaking Nest imports into the application layer."

### Result
- Added `src/application/ports/tokens.ts` with one `Symbol` per outbound port (`USER_REPOSITORY`, `PASSWORD_HASHER`, `TOKEN_SERVICE`, `CLOCK`, `ID_GENERATOR`). Tokens live in the application layer because they are part of the port contract, not a framework concern.
- Rewrote `src/app.module.ts` as the composition root:
  - `PrismaService` registered as a plain class provider.
  - Each adapter (`PostgresUserRepository`, `BcryptPasswordHasher`, `JwtTokenService`, `SystemClock`, `UuidGenerator`) registered under its port token via `useClass` or `useFactory` where env values are needed.
  - `JwtTokenService` wired via `useFactory` that reads `JWT_SECRET` and `JWT_EXPIRES_IN` from the env and converts the human-friendly duration string ("7d") into seconds using a local `parseExpiresIn` helper.
  - Use cases (`RegisterUserUseCase`, `LoginUseCase`) wired via `useFactory` with `inject: [...tokens]`, preserving the application layer's independence from Nest.
- Added `import 'dotenv/config'` as the very first line of `main.ts` so env vars are populated before any provider is instantiated.
- Verified the app boots without errors, listens on `/api`, and returns 404 for unknown routes (expected — no controllers yet).

### Files affected
- `src/application/ports/tokens.ts` (new)
- `src/main.ts` (added dotenv import)
- `src/app.module.ts` (rewritten as composition root)

**Test counts:** unchanged (108 unit + 9 integration). This block is about wiring, not new behavior.

### Modifications made by the developer
- Diagnosed the initial "JWT secret cannot be empty" error by reading `JwtTokenService` and confirming it received the secret as a constructor argument, not from `process.env` — this drove the decision to use `useFactory` for that specific provider instead of contaminating the adapter with env access.
- Rejected the temptation to add `@Injectable()` decorators to the use cases and instead used `useFactory` for them, keeping every use case free of Nest imports. This is a defense-ready choice: the application layer is portable to any framework.
- Verified `.env` location, `import 'dotenv/config'` position, and `JWT_SECRET` shape via `head`, `pwd`, and `grep` before touching code — the error message pointed at env loading but the actual root cause was elsewhere; skipping the diagnosis would have led to changes in the wrong file.
- Confirmed `BcryptPasswordHasher` has a default constructor argument and did NOT need the factory treatment, avoiding gratuitous refactoring.

### Lessons learned
- The composition root should be the only file in the project that knows both interfaces and their implementations. Everything else talks to abstractions. Getting this right is what makes a codebase testable, portable, and honest about its dependencies.
- Env-var parsing belongs at the composition root, not inside adapters. An adapter that reads `process.env` is a hidden dependency — it can't be tested without mutating global state. An adapter that receives typed values in its constructor is a pure function of its inputs.
- Nest's `useFactory` is the escape hatch that lets you use DI without letting the framework leak into your domain. Every time it appears, it's because a class chose to remain framework-agnostic. That's a feature.
- Reading the actual constructor signatures before writing the module (via `grep`) prevented at least one bug (wrong argument order in `RegisterUserUseCase`). Assumptions about "obvious" parameter order are how integration bugs sneak in at composition roots.
- When an error message says "X is empty", the interesting question is not "how do I fill X" but "who is supposed to fill X, and did they run?". The fix flowed naturally once we understood that `JwtTokenService` didn't consume the env — the module did.


## Entry 14 — Auth REST controller (DTOs + AuthController)

**Date**: 2026-07-06
**Tool**: Claude Opus 4.7 (via claude.ai)
**Task**: Build the first REST controller (Block 11.1) — DTOs, AuthController, and unit tests for the authentication endpoints.

**Prompt (paraphrased)**: With the application and infrastructure layers already wired through AppModule, and 108 unit tests plus 9 integration tests passing, I asked Claude to help me build the API layer for the two existing auth use cases. I wanted class-validator DTOs for the request bodies, a response DTO built from the AuthToken value object, a thin controller with no business logic, and hand-written fakes for the unit tests. The AuthController had to depend directly on the use case classes so Nest could resolve them from AppModule via the useFactory wiring already in place.

**Result**: Claude produced three DTOs (RegisterUserDto, LoginDto, AuthTokenResponseDto), the AuthController with POST /auth/register (201) and POST /auth/login (200), and a test suite with hand-written fakes for both use cases. Claude also flagged upfront that the use cases currently throw generic Error objects instead of typed domain errors, and deferred that refactor to Block 11.2 where the global exception filter will map them to HTTP status codes.

**Files affected**:
- `src/api/auth/dto/register-user.dto.ts` (new)
- `src/api/auth/dto/login.dto.ts` (new)
- `src/api/auth/dto/auth-token-response.dto.ts` (new)
- `src/api/auth/auth.controller.ts` (new)
- `src/app.module.ts` (added AuthController to the controllers array)
- `test/api/auth/auth.controller.spec.ts` (new, 8 tests)

**Modifications made by the developer**:
- Fixed a wiring bug that Claude's initial patch triggered: VS Code auto-import placed `AuthController` inside the `providers` array (not `controllers`) and added a spurious `import { App } from 'supertest/types'` line. The 404 responses from the smoke test made this obvious, and Claude walked me through the diagnosis by asking for the Nest startup logs (which had no `Mapped {/auth/register, POST}` line) and the output of `grep -A 2 "controllers:" src/app.module.ts` (which returned nothing).
- Ran four smoke tests manually with curl: valid registration (201), validation failure (400 with three aggregated messages from class-validator), duplicate registration (500 — expected, will be mapped to 409 by the exception filter in Block 11.2), and valid login (200).

**Lessons learned**:
- Design decision that will pay off in the defence: transport-level validation (min length, email format) lives in the DTO with class-validator decorators, while business rules (email uniqueness, credential correctness) stay in the use case and domain layer. The `LoginDto` deliberately does NOT enforce a minimum password length — enforcing it there would lock out legitimate users whose passwords predate a policy change, and it would leak the current policy to attackers.
- The controller is a pure transport-level adapter: three lines per endpoint (call use case, return DTO). No try/catch, no HTTP status mapping. That separation of concerns is exactly what Clean Architecture predicts and it's what makes the exception filter in Block 11.2 possible without touching the controller.
- IDE auto-imports are the enemy of clean composition roots. A single misplaced `AuthController,` inside `providers` cost a compile-clean but functionally broken app. Always verify the shape of `@Module({...})` with grep after edits.
- The default 500 response for uncaught domain errors leaks internal implementation details (Error message, stack trace in server logs). Block 11.2 will introduce typed domain errors and a global exception filter to map them to proper HTTP status codes (409 for duplicate email, 401 for invalid credentials).


## Entry 15 — Global exception filter with typed domain errors

**Date**: 2026-07-06
**Tool**: Claude Opus 4.7 (via claude.ai)
**Task**: Add a global exception filter and typed domain errors (Block 11.2) — the project's first AOP aspect (centralised exception handling).

**Prompt (paraphrased)**: The auth endpoints were returning HTTP 500 for domain-level failures (duplicate email, invalid credentials) because the use cases threw generic Error objects. I asked Claude to introduce typed domain errors and a global NestJS exception filter that maps them to proper HTTP status codes, without adding any try/catch or HTTP knowledge to the controllers or use cases. This is meant to be the first of the AOP aspects the rubric requires (Section 3.4, "Centralised Exception Handling"), implemented with a SOLID strategy rather than an AOP library.

**Result**: Claude produced:
- A `DomainError` abstract base class (with a `code` field and a prototype-chain fix so `instanceof` works across TS targets), plus `EmailAlreadyRegisteredError` (code EMAIL_ALREADY_REGISTERED) and `InvalidCredentialsError` (code INVALID_CREDENTIALS), all under `src/domain/errors/`.
- Refactored `RegisterUserUseCase` and `LoginUseCase` to throw the typed errors instead of generic Error.
- A global `DomainExceptionFilter` (`@Catch()`) that discriminates three cases: DomainError (mapped to status via an OCP-friendly Map, defaulting to 400), Nest HttpException (status/message preserved, so the ValidationPipe's 400 keeps working), and any other error (generic 500 that logs the stack on the server but never leaks internals to the client). All errors are returned in one consistent envelope: statusCode, error, message, code, timestamp, path.
- Registered the filter globally in `main.ts` via `app.useGlobalFilters`.
- 8 unit tests for the filter using hand-written fakes for ArgumentsHost / Response / Request.

**Files affected**:
- `src/domain/errors/domain-error.ts` (new)
- `src/domain/errors/email-already-registered.error.ts` (new)
- `src/domain/errors/invalid-credentials.error.ts` (new)
- `src/domain/errors/index.ts` (new)
- `src/application/usecases/auth/register-user.usecase.ts` (throw typed error)
- `src/application/usecases/auth/login.usecase.ts` (throw typed error, 3 sites)
- `src/api/filters/domain-exception.filter.ts` (new)
- `src/main.ts` (register global filter)
- `test/application/usecases/auth/register-user.usecase.spec.ts` (assert on type)
- `test/application/usecases/auth/login.usecase.spec.ts` (assert on type)
- `test/api/filters/domain-exception.filter.spec.ts` (new, 8 tests)

**Modifications made by the developer**:
- Updated the use-case tests to assert on error *type* (`toBeInstanceOf`) instead of on the error message string, after changing the register error message to include the offending email broke two string-based assertions. Deliberately left the login security test (`should_use_the_exact_same_error_message...`) asserting on the message, because there the message uniformity IS the security property being verified.
- Verified all four HTTP paths manually with `curl -i`: duplicate registration now returns 409 (was 500), wrong password returns 401 (was 500), invalid payload still returns 400 (ValidationPipe untouched), valid login still returns 200.

**Lessons learned**:
- This is the centrepiece AOP aspect for the defence. The cross-cutting concern (error -> HTTP translation) is fully separated from business code: controllers and use cases contain zero try/catch for HTTP mapping. The SOLID strategy is explicit — OCP via the status Map (new domain errors need one entry, never a code change to `catch`), SRP (the filter only translates), DIP (it branches on the DomainError abstraction).
- Extending the built-in Error class in TypeScript silently breaks `instanceof` unless you call `Object.setPrototypeOf(this, new.target.prototype)` in the base constructor. Without it, the filter's `instanceof DomainError` check would fail and every domain error would fall through to 500.
- A generic `@Catch()` filter intercepts Nest's own HttpExceptions too, so the filter must explicitly re-handle them (branch 2) or it would break the ValidationPipe's 400 responses. Confirmed with a smoke test that the 400 still carries the aggregated validation messages.
- Asserting on error type instead of error message makes tests robust to wording changes — but the reverse is correct when the message itself is the observable behaviour (the anti-enumeration security test). Knowing which is which is the point of "test behaviour, not implementation".


## Entry 16 — Swagger / OpenAPI documentation

**Date**: 2026-07-06
**Tool**: Claude Opus 4.7 (via claude.ai)
**Task**: Add Swagger / OpenAPI documentation to the backend (Block 11.3), satisfying the API documentation requirement.

**Prompt (paraphrased)**: With the auth endpoints and the global exception filter in place, I asked Claude to add Swagger documentation served at /api/docs. I wanted the OpenAPI schema to be generated from the same DTOs that already drive validation, rather than maintaining a separate spec, and I wanted the controller to document every HTTP status code the endpoints can return (including the ones produced by the exception filter).

**Result**: Claude:
- Installed @nestjs/swagger (v8, compatible with our NestJS 11).
- Configured a DocumentBuilder in main.ts (title, description, version, bearer-auth scheme, auth tag) and served the UI at /api/docs, respecting the existing global 'api' prefix.
- Added @ApiProperty to every field of RegisterUserDto, LoginDto and AuthTokenResponseDto, each with a description and a realistic example.
- Annotated AuthController with @ApiTags, @ApiOperation and @ApiResponse so the docs list 201/400/409 for register and 200/400/401 for login, matching exactly what the DomainExceptionFilter produces.

**Files affected**:
- `package.json` / `package-lock.json` (added @nestjs/swagger)
- `src/main.ts` (Swagger DocumentBuilder + setup)
- `src/api/auth/dto/register-user.dto.ts` (@ApiProperty)
- `src/api/auth/dto/login.dto.ts` (@ApiProperty)
- `src/api/auth/dto/auth-token-response.dto.ts` (@ApiProperty)
- `src/api/auth/auth.controller.ts` (@ApiTags / @ApiOperation / @ApiResponse)

**Modifications made by the developer**:
- Verified the /api/docs UI in the browser: both endpoints render with summaries, field-level descriptions and examples, documented status codes, and a working "Try it out" panel.
- Ran the full suite to confirm the annotations are pure metadata and change no behaviour (124 unit tests still passing across 13 suites).
- Noted 15 npm audit warnings introduced by transitive dependencies; deliberately did NOT run `npm audit fix --force` to avoid breaking-change upgrades this close to delivery. Flagged for a careful review at the end of the project.

**Lessons learned**:
- The DTO is the single source of truth for the HTTP contract: one class drives runtime validation (class-validator), compile-time typing, and the OpenAPI schema (@ApiProperty). The documented contract cannot drift from the enforced one because they come from the same decorators.
- Documenting @ApiResponse status codes only makes sense because the exception filter guarantees them centrally. The docs describe 409/401 that no controller code explicitly throws — they come from the filter mapping domain errors. Documentation and the AOP aspect reinforce each other.
- SwaggerModule.setup respects the global prefix, so the correct path is 'api/docs' (no leading slash) to land at /api/docs rather than /docs.


## Entry 17 — End-to-end tests for the auth endpoints (supertest)

**Date**: 2026-07-06
**Tool**: Claude Opus 4.7 (via claude.ai)
**Task**: Add end-to-end tests (Block 11.4) that drive the whole application over HTTP, closing Block 11.

**Prompt (paraphrased)**: With the auth endpoints, exception filter and Swagger docs done, I asked Claude to add E2E tests using supertest that boot the entire Nest app and hit the endpoints over real HTTP against the arrowmaze_test database. I wanted them to reuse the existing integration guard (which refuses to run unless DATABASE_URL points at arrowmaze_test) and the existing DatabaseCleaner, and to run in-band since they touch the database.

**Result**: Claude:
- Fixed the pre-existing jest-e2e.json (from the Nest scaffold): changed rootDir to '..' and added setupFiles pointing at the shared jest-integration.setup.ts guard, so E2E tests cannot touch the dev database.
- Added --runInBand to the test:e2e script.
- Wrote test/api/auth/auth.e2e-spec.ts: 8 tests booting the full AppModule via Test.createTestingModule, configured exactly like main.ts (global prefix, ValidationPipe, DomainExceptionFilter), driven with supertest. Covers register 201/400/400/409 and login 200/401/401, plus an end-to-end anti-enumeration check that unknown-email and wrong-password produce an identical 401 body.
- Removed the orphaned scaffold test test/app.e2e-spec.ts, which asserted a GET / "Hello World!" endpoint this project never had.

**Files affected**:
- `test/jest-e2e.json` (rootDir + setupFiles guard)
- `package.json` (test:e2e now runs --runInBand)
- `test/api/auth/auth.e2e-spec.ts` (new, 8 tests)
- `test/app.e2e-spec.ts` (deleted, orphaned scaffold)

**Modifications made by the developer**:
- First run failed with `(0, supertest_1.default) is not a function`. Claude diagnosed it as the ESM default-import style; changed `import request from 'supertest'` to `import * as request from 'supertest'`, which matches how Nest scaffolds its own E2E tests. Second run: 8/8 green.
- Confirmed the full unit suite still passes (124 in 13 suites) and E2E passes separately (8 in 1 suite) via npm run test:e2e.

**Lessons learned**:
- Three distinct test levels now map cleanly onto the rubric's categories: unit (fakes, fast, `npm test`), integration (one adapter vs real Postgres, `npm run test:integration`), and E2E (whole app over HTTP vs real Postgres, `npm run test:e2e`). Keeping them in separate configs makes the distinction defensible.
- E2E tests are destructive (they truncate tables), so they MUST inherit the same arrowmaze_test guard as the integration tests. Reusing jest-integration.setup.ts rather than writing a second guard keeps the safety invariant in one place.
- supertest has no ESM default export under this TS config, so the star-import form is required. Nest's own scaffold uses the same form, which is a good sanity anchor when an import fails.
- The anti-enumeration property is now verified at every level: unit (use case), and E2E (real HTTP round-trip). A security guarantee that holds end-to-end is far stronger evidence than a unit test alone.


## Critical evaluation (in progress)

This section will be updated at the end of the project with:
- Approximate percentage of code with AI assistance.
- Notable cases where AI produced incorrect or suboptimal output.
- Team reflection on the impact of AI on productivity and code quality.