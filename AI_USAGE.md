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


## Entry 18 — Logging interceptor (AOP aspect #2)

**Date**: 2026-07-07
**Tool**: Claude Opus 4.7 (via claude.ai)
**Task**: Add a global logging/tracing interceptor as the second AOP aspect (Block 12), keeping the tracing concern out of the business code.

**Prompt (paraphrased)**: With the exception filter already serving as the first AOP aspect, I asked Claude to add a NestJS interceptor that logs the entry, exit and duration of every request without putting any logger call inside the use cases or controllers, matching the rubric's "logging and tracing" aspect (Section 3.4). I wanted it registered globally, implemented with a SOLID strategy, and — importantly — I did not want it to log request bodies, since those contain plaintext passwords.

**Result**: Claude produced:
- `LoggingInterceptor` (`src/api/interceptors/logging.interceptor.ts`), a global NestInterceptor that records `--> METHOD url` on entry and `<-- METHOD url status elapsedMs` on exit, using RxJS `tap` to hook the "after" phase onto the response stream. On error it logs a warning with the error name/message and elapsed time, then lets the error propagate to the exception filter (it does not swallow it).
- Registered it globally in `main.ts` via `app.useGlobalInterceptors`.
- 4 unit tests using fakes for ExecutionContext and CallHandler (the latter returning an RxJS Observable), covering value pass-through, entry/exit logging, error logging + re-throw, and a guard that no log line contains the word "password".

**Files affected**:
- `src/api/interceptors/logging.interceptor.ts` (new)
- `src/main.ts` (register global interceptor)
- `test/api/interceptors/logging.interceptor.spec.ts` (new, 4 tests)

**Modifications made by the developer**:
- First run failed because the FakeCallHandler was typed with `ReturnType<typeof of>`, which does not match the overloaded RxJS `of` and rejected the observable argument. Claude diagnosed it as a typing issue (the suite failed to compile, so its tests never ran) and fixed it by typing the fake as `Observable<unknown>`, matching the CallHandler interface.
- Verified manually with curl: a failed login logged `--> POST /api/auth/login` and `<-- ... FAILED (InvalidCredentialsError: Invalid credentials) 7ms`, with the password from the request body NOT appearing anywhere in the logs.

**Lessons learned**:
- Interceptor vs filter is the clean way to explain two different AOP mechanisms in the defence: the interceptor runs on every request with a before/after phase (timing), while the filter runs only on failure (error mapping). The two aspects collaborate — the interceptor observed the typed InvalidCredentialsError and the filter turned it into the 401 — yet neither touches the business code.
- Security by omission is a deliberate design choice worth defending: the interceptor logs only method, path, status and duration, never the body/headers/query, mirroring the redacted toString() on PasswordHash and AuthToken. A naive logger would leak plaintext passwords.
- Typing test fakes that return RxJS streams: use `Observable<unknown>` for the CallHandler stub, not `ReturnType<typeof of>`. The latter does not generalise across of()/throwError() and breaks compilation.
- Interceptors that log errors must re-throw (RxJS `tap`'s error callback observes without consuming), so the exception filter still produces the HTTP response. The test asserts the error propagates.

## Entry 19 — JWT auth guard + GET /auth/me (AOP aspect #3)

**Date**: 2026-07-08
**Tool**: Claude Opus 4.7 (via claude.ai)
**Task**: Add the third AOP aspect — a JWT authentication guard — justified by a real protected endpoint, GET /auth/me. This completes the 3 aspects the rubric rewards with full marks.

**Prompt (paraphrased)**: With the exception filter and logging interceptor already in place as aspects #1 and #2, I asked Claude to add a JWT authentication guard as aspect #3, but applied to a genuinely protected endpoint rather than in a vacuum. We chose GET /auth/me (returns the authenticated user's profile) so the guard has something real to protect. The guard had to keep all token logic out of the controller: the handler should simply trust that if it runs, the caller is authenticated.

**Result**: Claude produced:
- InvalidTokenError (domain error, code INVALID_TOKEN), added to the barrel and mapped to 401 in the exception filter's status Map (one-line OCP extension).
- GetUserByIdUseCase + command (application layer), which loads the user and throws InvalidTokenError if the id no longer exists.
- JwtAuthGuard (src/api/guards): extracts the Bearer token, verifies it via the existing ITokenService.verify port, attaches userId to the request, and throws InvalidTokenError on any failure (missing header, wrong scheme, bad/expired token) without distinguishing the cause.
- UserResponseDto: serializes only id, email, displayName, createdAt — the password hash is deliberately never exposed.
- GET /auth/me on AuthController, protected with @UseGuards(JwtAuthGuard); the handler just reads request.userId and delegates. Registered GetUserByIdUseCase (factory) and JwtAuthGuard (provider) in AppModule, and cleaned up a stray self-referential AppModule export.
- 5 unit tests for the guard and 4 E2E tests for /me (valid token 200, hash never exposed, missing header 401, malformed token 401).

**Files affected**:
- `src/domain/errors/invalid-token.error.ts` (new) + `index.ts` (barrel)
- `src/api/filters/domain-exception.filter.ts` (map InvalidTokenError -> 401)
- `src/application/usecases/auth/get-user-by-id.command.ts` (new)
- `src/application/usecases/auth/get-user-by-id.usecase.ts` (new)
- `src/api/guards/jwt-auth.guard.ts` (new)
- `src/api/auth/dto/user-response.dto.ts` (new)
- `src/api/auth/auth.controller.ts` (GET /auth/me)
- `src/app.module.ts` (register use case + guard, clean exports)
- `test/api/guards/jwt-auth.guard.spec.ts` (new, 5 tests)
- `test/api/auth/auth.controller.spec.ts` (updated for the 3-arg constructor)
- `test/api/auth/auth.e2e-spec.ts` (4 new /me E2E tests)

**Modifications made by the developer**:
- After wiring the guard, the full unit suite dropped a suite: auth.controller.spec.ts failed to compile with TS2554 "Expected 3 arguments, but got 2" because adding GetUserByIdUseCase to the controller constructor broke the three places the controller-spec instantiated it with only two fakes. Fixed by adding a FakeGetUserByIdUseCase and updating all three constructions (and the fake instantiations) via editor Replace-All.
- Smoke-tested the full flow with curl: register/login -> copy token -> GET /me with Bearer returns 200 with the profile and NO password hash; no header -> 401 INVALID_TOKEN; garbage token -> 401. Learned in passing that JWTs are fragile to hand-copying from the terminal (a mis-copied token reads as invalid), so used a shell variable (TOKEN=$(...)) to pipe the real token through.
- Final suite counts: 133 unit (15 suites), 9 integration, 12 E2E.

**Lessons learned**:
- Three AOP aspects now cover three distinct cross-cutting concerns, each with a clean SOLID justification: the filter (error mapping, OCP via a status Map), the interceptor (tracing, security-by-omission of the body), and the guard (authentication, DIP on ITokenService). None of them lives inside a use case or leaks into the controller handlers — GET /auth/me is three trivial lines because the guard already did the work.
- Adding a constructor dependency is a breaking change to every test that news-up the class by hand. Hand-written fakes trade a bit of this maintenance for clarity; the fix is mechanical but must touch every construction site. Worth remembering before changing a widely-instantiated constructor.
- The password hash is excluded at the DTO boundary (UserResponseDto.from), not by hoping callers do not ask for it. The E2E test asserts the bcrypt prefix "$2b$" appears nowhere in the response body, which is a robust guard against a future regression that adds the field under any key.
- Reusing the already-present ITokenService.verify (added in an earlier session) meant aspect #3 needed no changes to the domain or the token adapter — a payoff from having defined the port with both issue and verify from the start.



## Entry 20 — Move AuthToken out of the domain layer into application

**Date**: 2026-07-08
**Tool**: Claude Opus 4.7 (via claude.ai)
**Task**: Relocate the AuthToken value object from the domain layer to the application layer, after peer feedback (and a reference project) pointed out that a token is not a business rule of the game domain.

**Prompt (paraphrased)**: A friend whose team scored well last semester reviewed the design and argued that auth tokens do not belong in the domain — his own project keeps auth under an infrastructure/auth folder, not in the domain. I asked Claude to evaluate this and move AuthToken to the most correct layer without breaking the 133 unit / 9 integration / 12 e2e tests.

**Result**: Claude analysed the dependency direction before moving anything. Moving AuthToken to infrastructure would have been wrong: the ITokenService port and the register/login use cases (both in the application layer) reference AuthToken, and the dependency rule forbids the application layer from importing infrastructure. The correct home is the application layer itself: infrastructure (JwtTokenService) and api (AuthTokenResponseDto) may depend inward on it, while the port and use cases sit in the same layer. Claude moved src/domain/models/auth-token.ts to src/application/models/auth-token.ts (and its spec) with git mv to preserve history, then updated all 11 imports across code and tests, each with its correct relative depth.

**Files affected**:
- `src/application/models/auth-token.ts` (moved from src/domain/models/)
- `test/application/models/auth-token.spec.ts` (moved from test/domain/models/)
- `src/application/ports/out/token-service.port.ts` (import)
- `src/application/usecases/auth/register-user.usecase.ts` (import)
- `src/application/usecases/auth/login.usecase.ts` (import)
- `src/infrastructure/security/jwt-token-service.ts` (import)
- `src/api/auth/dto/auth-token-response.dto.ts` (import)
- 5 test files (imports updated)

**Modifications made by the developer**:
- First git mv of the spec failed because the destination folder test/application/models did not exist yet; created it with mkdir and re-ran the git mv successfully.
- After fixing the 11 imports, verified all three test levels still pass with zero behaviour change: 133 unit (15 suites), 9 integration, 12 e2e. Reviewed the DeltaTeam-UCAB/gymnastic-center-backend repository as an architectural reference for where auth concerns belong (their auth lives under infraestructure/auth), which prompted this refactor.

**Lessons learned**:
- "Move it out of the domain" is correct, but "move it to infrastructure" would have been a worse violation than the original. The dependency rule decides the target layer: since the application-layer port and use cases reference AuthToken, it belongs in application, where inner-to-outer dependencies stay legal. The infrastructure detail is HOW the token is signed (JWT, in JwtTokenService), not the concept of "a token with an expiry".
- A token is not a business rule of the game domain (players, boards, levels, scores are). Keeping the domain limited to genuine business concepts makes the layering defensible under questioning.
- git mv preserves file history (shows as a rename, not delete+add), which keeps the individual-contribution trail intact for the rubric's commit-history review.
- Studying a well-graded reference project is a legitimate way to sharpen architectural judgement, as long as the patterns (not the code) are adapted; noted the reference in this entry for transparency.

## Entry 21 — Logging as a GoF Decorator over use cases

**Date**: 2026-07-08
**Tool**: Claude Opus 4.7 (via claude.ai)
**Task**: Add a logging aspect implemented as a classic GoF Decorator wrapping the use cases, complementing the existing Nest interceptor and covering the structural-pattern category of the rubric.

**Prompt (paraphrased)**: After studying the DeltaTeam-UCAB/gymnastic-center-backend reference project — which wraps its application services in decorators rather than relying on framework interceptors — I asked Claude to implement the same idea on my use cases: a LoggingUseCaseDecorator that shares the use case interface, wraps a real use case, logs entry/exit/duration around execute(), and is wired in the composition root. The goal was to satisfy two rubric criteria at once: the GoF Decorator pattern (structural) and an AOP cross-cutting concern implemented with plain SOLID, no AOP library.

**Result**: Claude produced:
- A shared UseCase<TCommand, TResult> interface (src/application/usecases/use-case.ts); RegisterUserUseCase, LoginUseCase and GetUserByIdUseCase now implement it (no behaviour change).
- LoggingUseCaseDecorator<TCommand, TResult> (src/application/decorators): implements the same UseCase interface, wraps an inner use case, logs "--> name" on entry and "<-- name OK/FAILED elapsedMs" on exit, and re-throws on failure so the contract is preserved. It depends on a small UseCaseLogger interface (not Nest's Logger) to keep the application layer framework-free.
- Wired all three use cases in AppModule so each factory returns the use case wrapped in the decorator, using Nest's Logger (which satisfies UseCaseLogger) supplied at the composition root.
- 6 unit tests for the decorator (result unchanged, command forwarded, entry/exit logged, error re-thrown, error type logged, command contents never logged).

**Files affected**:
- `src/application/usecases/use-case.ts` (new interface)
- `src/application/usecases/auth/register-user.usecase.ts` (implements UseCase)
- `src/application/usecases/auth/login.usecase.ts` (implements UseCase)
- `src/application/usecases/auth/get-user-by-id.usecase.ts` (implements UseCase)
- `src/application/decorators/logging-use-case.decorator.ts` (new)
- `src/app.module.ts` (wrap each use case in the decorator)
- `test/application/decorators/logging-use-case.decorator.spec.ts` (new, 6 tests)

**Modifications made by the developer**:
- Verified at runtime that both logging aspects now operate in layers for one request: the Nest interceptor logs the HTTP round-trip while the decorator logs the use case execution nested inside it (interceptor 7ms total, decorator 5ms for the use case alone), with the InvalidCredentialsError travelling through both to the exception filter.
- Confirmed all suites pass: 139 unit (16 suites), 9 integration, 12 e2e.
- Studied the reference repo for the pattern (wrapping application services in decorators), then implemented it independently on my own use cases and interface; noted here for transparency.

**Lessons learned**:
- The Decorator hits two rubric criteria with one artefact: it is the GoF structural pattern that was previously under-covered, and it is an AOP aspect built with plain SOLID (no library), which is exactly what the brief asks for.
- Decorator vs Nest interceptor is a clean talking point: the interceptor is framework AOP at the HTTP boundary; the decorator is hand-rolled AOP at the application boundary, portable to a CLI or worker with no controller. They stack, and the nested timings prove they observe different layers.
- LSP is what makes the wiring type-check without touching the controller: because the decorator implements the same UseCase interface, Nest can hand the controller a decorated instance under the same class token and the controller cannot tell the difference.
- Keeping the decorator's logger dependency as a small UseCaseLogger interface (instead of importing Nest's Logger) preserves the application layer's freedom from framework imports — the concrete Nest Logger is injected only at the composition root.


## Entry 22 — Level catalog vertical slice with a creational Factory Method

**Date**: 2026-07-08
**Tool**: Claude Opus 4.8 (via claude.ai)
**Task**: Build the first game-facing backend feature — the level catalog — as a full vertical slice across all four layers, and in doing so cover the one missing GoF category (creational). This unblocks the Flutter front end, which needs a stable levels contract to consume.

**Prompt (paraphrased)**: I told Claude to continue the project and pick whatever maximized my grade, giving it freedom over the design and data types with a single hard constraint from my professor: no enums anywhere. After Claude first designed cell classes that belonged in the app rather than the backend, I supplied my Lucid UML. We then modeled, faithful to that UML: a Level aggregate (Level + BoardLayout + CellInfo) where the board is flat persistence data (not the app's polymorphic cell hierarchy), a DifficultyProfile Strategy (Easy/Medium/Hard) replacing a difficulty enum, and a DifficultyProfileFactory (Factory Method) that materializes the profile from the stored label — the creational pattern the backend was missing. On top: a ListLevels use case (published-only), a Postgres adapter + mapper that runs the factory on read, a public GET /levels endpoint, a LevelNotFoundError wired into the exception filter, an idempotent seed, and tests at all three levels.

**Result**: Claude produced:
- Domain: Score, DifficultyProfile (Strategy) with Easy/Medium/Hard, DifficultyProfileFactory (Factory Method), CellInfo, BoardLayout (validates board invariants: exactly one START, at least one EXIT, no overlaps, in-bounds), Level entity (holds a DifficultyProfile, not a label; effectiveParTimeMs applies the multiplier), and LevelNotFoundError.
- Application: ILevelRepository port (findById/findAll/findAllPublished/save), LEVEL_REPOSITORY token, ListLevelsCommand + ListLevelsUseCase (implements UseCase, returns published levels only).
- Infrastructure: LevelMapper (Data Mapper; toDomain runs DifficultyProfileFactory and re-validates the board), PostgresLevelRepository (Adapter/Repository over Prisma).
- API: LevelResponseDto (constructor-private + static from; exposes the effective par time), LevelsController (thin, public GET /levels), and the LevelNotFoundError -> 404 entry in the exception filter's OCP map.
- Persistence: Level Prisma model (reshaped to the UML), two migrations, and an idempotent seed of three published levels built through the real repository so they pass full domain validation.
- Tests: 21 new unit tests (Score, DifficultyProfile, its factory, CellInfo, BoardLayout, Level, ListLevelsUseCase), 8 integration tests against real Postgres (including a difficulty round-trip proving the factory works end to end), and 6 e2e tests over HTTP (including effective par time and arrow-direction preservation). Totals after the slice: 192 unit (23 suites), 17 integration, 18 e2e. A curl against the running app returned the three seeded levels with correct effective par times (Easy 120000x1.5=180000, Hard 90000x0.75=67500).

**Files affected**:
- `src/domain/models/score.ts`, `difficulty-profile.ts`, `difficulty-profile.factory.ts`, `cell-info.ts`, `board-layout.ts`, `level.ts` (all new)
- `src/domain/errors/level-not-found.error.ts` (new), `src/domain/errors/index.ts` (export it)
- `src/application/ports/out/level-repository.port.ts` (new), `src/application/ports/tokens.ts` (LEVEL_REPOSITORY)
- `src/application/usecases/levels/list-levels.command.ts`, `list-levels.usecase.ts` (new)
- `src/infrastructure/persistence/level.mapper.ts`, `postgres-level.repository.ts` (new)
- `src/api/levels/dto/level-response.dto.ts`, `src/api/levels/levels.controller.ts` (new)
- `src/api/filters/domain-exception.filter.ts` (LevelNotFoundError -> 404), `src/app.module.ts` (wire controller + use case)
- `prisma/schema.prisma` (Level model), `prisma/migrations/*` (two migrations), `prisma/seed.ts` (new), `package.json` (seed script)
- `test/domain/models/*.spec.ts` (6 new), `test/application/usecases/levels/list-levels.usecase.spec.ts` (new), `test/infrastructure/persistence/postgres-level.repository.integration-spec.ts` (new), `test/api/levels/levels.e2e-spec.ts` (new), `test/infrastructure/helpers/database-cleaner.ts` (truncate levels too)

**Modifications made by the developer**:
- Enforced the "no enums" project constraint and gave Claude design freedom; supplied the Lucid UML when Claude's first cell design turned out to belong in the app rather than the backend, then had it model the backend faithfully to that UML.
- Applied every edit in my editor, ran both migrations (dev and test DBs), ran the seed, and verified the endpoint over HTTP with curl.
- Caught a misplaced spec that had been created under test/application/usecases/auth/levels/ and moved it to .../levels/, keeping the test tree honest.
- Read Jest output to confirm counts rather than trusting claimed numbers; a fixture bug (three levels sharing index 0) surfaced the real @unique(index) constraint in the integration DB and was fixed by giving each fixture a distinct index.

**Lessons learned**:
- The backend and the app are two different domains on purpose: the server stores a flat board (CellInfo with string type/direction) while the app owns the polymorphic Cell hierarchy and its own CellFactory. Putting the creational pattern in the backend as DifficultyProfileFactory covers the rubric's creational category without waiting on the Flutter phase — insurance against the game slipping.
- Strategy over enum is not just constraint compliance: an enum only names the tiers and forces callers to switch for behavior, while the DifficultyProfile puts the behavior in the type, so nothing branches and a new tier is one subclass (OCP).
- The Factory Method earns its place on the hot path: LevelMapper.toDomain runs it on every read, turning the stored label into the right strategy. The integration test proves a "HARD" row comes back as a HardProfile instance, not a decorative pattern bolted on the side.
- Verifying against reality beats assuming: reading the actual Jest summary, the git status, and the curl output — instead of trusting a remembered count — caught the misplaced spec and the fixture collision before they were committed.



## Entry 23 — Player progress vertical slice with protected endpoints

**Date**: 2026-07-09
**Tool**: Claude Opus 4.8 (via claude.ai)
**Task**: Build the progress feature — the last backend piece a playable game needs — as a full vertical slice across all four layers. With auth, levels, and now progress, the backend covers everything the Flutter client needs for a functional MVP, freeing the remaining time for the game itself (the highest-risk criterion).

**Prompt (paraphrased)**: I asked Claude to keep doing whatever was most optimal toward finishing the whole project, not just starting the front end. Claude's strategic read: the only high-risk criterion is the Flutter game (heaviest, unfamiliar, with a learning curve), so the goal was to finish the minimum backend a playable game needs and get to Flutter with margin. That minimum was progress. We built the minimal-playable version (SubmitScore + GetProgress) rather than the UML's full SyncProgress/merge policy, keeping surface small. Faithful to the UML: a PlayerProgress aggregate holding LevelProgressEntry items, where the "best score wins, attempt counted" rule lives in the aggregate (using Score.compareTo), two use cases, a Postgres adapter whose (userId, levelId) unique constraint makes saving idempotent, and two JWT-protected endpoints where identity comes from the token, never the body.

**Result**: Claude produced:
- Domain: LevelProgressEntry (value object; withNewAttempt keeps the better score, counts the attempt, preserves the first-completion date) and PlayerProgress (aggregate root; record() applies the best-score rule, bestFor() looks up a level). Reuses the Score value object from Entry 22.
- Application: IProgressRepository port (findByUser returns an empty aggregate, never null; save), PROGRESS_REPOSITORY token, SubmitScore + GetProgress commands and use cases. SubmitScore stamps completion time from the IClock port, not the client, so a run cannot be backdated.
- Infrastructure: ProgressMapper (maps one entry per row, since a PlayerProgress spans many rows; score stored as flat columns for future leaderboard ordering) and PostgresProgressRepository (upserts each entry keyed by the unique constraint; preserves each row's id on update).
- API: SubmitScoreDto (class-validator bounds: stars 0-3, non-negative, so bad input dies as a 400 before the use case), ProgressResponseDto (constructor-private + static from), ProgressController (class-level @UseGuards(JwtAuthGuard); reads request.userId set by the guard; GET and POST /me/progress).
- Persistence: ProgressEntry Prisma model with @@unique([userId, levelId]), one migration applied to dev and test DBs.
- Tests: 24 new unit (LevelProgressEntry, PlayerProgress, both use cases with hand-written fakes and a fixed clock), 5 integration against real Postgres (including idempotency: saving the same level twice updates, never duplicates), 7 e2e over HTTP with real auth (including best-score-kept across submissions and progress scoped to the authenticated user). Totals after the slice: 216 unit (27 suites), 22 integration, 25 e2e. A curl to GET /api/me/progress without a token returned 401, confirming the guard protects the route.

**Files affected**:
- `src/domain/models/level-progress-entry.ts`, `player-progress.ts` (new)
- `src/application/ports/out/progress-repository.port.ts` (new), `src/application/ports/tokens.ts` (PROGRESS_REPOSITORY)
- `src/application/usecases/progress/submit-score.command.ts`, `submit-score.usecase.ts`, `get-progress.command.ts`, `get-progress.usecase.ts` (new)
- `src/infrastructure/persistence/progress.mapper.ts`, `postgres-progress.repository.ts` (new)
- `src/api/progress/dto/submit-score.dto.ts`, `progress-response.dto.ts`, `src/api/progress/progress.controller.ts` (new)
- `src/app.module.ts` (wire the controller, the progress adapter via useFactory, and both use cases)
- `prisma/schema.prisma` (ProgressEntry model), `prisma/migrations/*` (one migration)
- `test/domain/models/level-progress-entry.spec.ts`, `player-progress.spec.ts` (new), `test/application/usecases/progress/*.spec.ts` (new), `test/infrastructure/persistence/postgres-progress.repository.integration-spec.ts` (new), `test/api/progress/progress.e2e-spec.ts` (new), `test/infrastructure/helpers/database-cleaner.ts` (truncate progress_entries too)

**Modifications made by the developer**:
- Chose the minimal-playable scope over the full UML merge policy, and gave Claude design freedom toward finishing the whole project.
- Applied every edit, ran the migration on both dev and test DBs, and verified the protected route returns 401 without a token via curl.
- Noticed the new integration spec was named "postgress-progress" (double s) while the others were "postgres-", and had it renamed for a consistent test tree — spotted by asking why its file icon differed from the other specs.
- Read the Jest summaries to confirm counts rather than trust claimed numbers (Claude miscounted one unit total during the block; the real Jest output settled it).

**Lessons learned**:
- The business rule is what makes this more than CRUD: "best score wins" lives in the aggregate (PlayerProgress.record / LevelProgressEntry.withNewAttempt via Score.compareTo), not in the controller or SQL, and is proven at three levels — domain unit test, use-case test, and an HTTP e2e that submits a worse run and sees the better score survive.
- Security by construction: the userId is taken from the verified JWT (attached by the guard), never from the request body, and completion time comes from the server's IClock. An e2e with two distinct users proves each sees only their own progress; a curl proves the route rejects unauthenticated callers.
- The composition root broke twice while wiring, and each time Nest's error named the exact cause: first a provider (LEVEL_REPOSITORY) was accidentally replaced instead of appended, then the two progress use-case providers were missing. Reading the "can't resolve dependencies of X" message and confirming with grep — instead of guessing at a malformed block — found each fix quickly. A wrong early hypothesis (a broken brace) was discarded once the actual providers array was inspected.
- Idempotency belongs in the schema, not just the code: the @@unique([userId, levelId]) constraint is what guarantees a replayed submission updates one row rather than duplicating it, and the integration test proves it against a real database.

## Entry 24 — Phase 0 backend hardening: audit fixes and cross-cutting refactors
**Date**: 2026-07-11
**Tool**: Claude Opus 4.8 (via claude.ai)
**Task**: Before starting the v2 breaking-change work (arrow-path domain, server-authoritative scoring, wallet/economy), the backend needed a sanitization pass to close every open finding in AUDIT-Backend.md and eliminate three cross-cutting smells that would only get worse as the surface grew. Worked across two sessions, ships eight sub-blocks plus two pre-existing debts that surfaced along the way, and closes Phase 0.A of PLAN-MASTER end to end.
**Prompt (paraphrased)**: I asked Claude to work in the smallest verifiable sub-blocks possible — one audit finding or one refactor per commit, each with its own tsc/tests/commit cycle — so that regressions would surface with a single suspect and the git history would double as a defense narrative. Strategic framing was mine: the v2 refactor is heavy, breaking, and cross-repo, so the launchpad had to be clean before we touched it. Claude's role each round was to propose the exact minimal edit, wait for confirmation of green tests, then move on.
**Result**: Five audit fixes, three refactors, and two chores that surfaced when the refactors ran suites nobody had touched in weeks:
- **0.A.1 — displayName whitespace → 400**: `@Matches(/\S/)` on RegisterUserDto plus a dedicated DTO spec (4 tests) that verifies whitespace-only, missing, and valid inputs at the pipe boundary. Cost: one decorator, one file. Value: no more 500s for a bad string.
- **0.A.2 — register race → 409**: PostgresUserRepository.save wrapped in a try/catch that maps Prisma's `P2002` unique-violation to `EmailAlreadyRegisteredError`. Closes the check-then-act window between the use case's existence check and the insert.
- **0.A.3 — `@updatedAt` on ProgressEntry**: schema-only change; no SQL migration is generated (it is a Prisma client directive), so a `prisma generate` was enough. Confirmed by rerunning the progress integration spec.
- **0.A.4 — `.env.example`**: placeholders for DATABASE_URL, JWT_SECRET, JWT_EXPIRES_IN, PORT, ADMIN_API_KEY, with `!.env.example` added to `.gitignore` so future secrets never overwrite the template.
- **0.A.5 — main.ts hardening**: `app.enableShutdownHooks()` so SIGTERM/SIGINT drain Prisma cleanly, plus an explicit `bootstrap().catch(err => { console.error(...); process.exit(1); })` so a missing JWT_SECRET or a busy port dies loud instead of a floating rejection. Verified by booting with `JWT_SECRET=` and with the port taken.
- **Chore — level integration spec migrated to ARROW/EMPTY**: pre-existing debt. The previous session's `START/WALL/EXIT → ARROW/EMPTY` refactor had updated domain + unit tests + seed but never touched the level integration spec; nobody had run `test:integration` since. Migrated `buildBoard`, seven tests recovered.
- **0.A.6 — `@CurrentUserId()` param decorator**: created `src/api/common/decorators/current-user-id.decorator.ts` and killed the triplicated `(request as Request & { userId: string }).userId` cast in AuthController.me, ProgressController.get, and ProgressController.submit. The decorator hides the JwtAuthGuard's contract from the handlers and reads like intent.
- **0.A.8 — `configureApp(app)` extracted**: `src/configure-app.ts` now owns CORS, global prefix, ValidationPipe, DomainExceptionFilter, LoggingInterceptor, and shutdown hooks — one source of truth for cross-cutting config. main.ts calls it; all three e2e specs call it. Before this, the specs mirrored main.ts by hand and had already drifted (interceptor and CORS missing). Running the e2e suite from `main.ts`'s perspective for the first time in weeks (a side-effect of this refactor) surfaced five failing tests in the levels e2e spec — the same `START/WALL/EXIT` debt as the integration one, but hiding in the e2e layer.
- **Chore — levels e2e spec migrated to ARROW/EMPTY**: five tests recovered.
- **0.A.7 — `withLogging` helper**: collapsed six identical `new LoggingUseCaseDecorator(new XUseCase(...), 'XUseCase', new Logger('UseCase'))` blocks in AppModule into `withLogging(new XUseCase(...), 'XUseCase')`. Generic in `<C, R>` so each use case keeps its typed command/result signatures through the wrap. OCP applied to the composition root itself: swapping in a metrics decorator or a structured logger now touches one line, not six.

Final baseline after the block: 220 unit / 21 integration / 25 e2e, all green. Nine commits shipped, all Conventional Commits, all pushed to origin/main.
**Files affected**:
- `src/api/auth/dto/register-user.dto.ts` (`@Matches`), `test/api/auth/dto/register-user.dto.spec.ts` (new, 4 tests)
- `src/infrastructure/persistence/postgres-user.repository.ts` (P2002 catch), `test/infrastructure/persistence/postgres-user.repository.integration-spec.ts` (race case)
- `prisma/schema.prisma` (`@updatedAt`)
- `.env.example` (new), `.gitignore`
- `src/main.ts` (shutdown hooks + bootstrap catch; then rewritten to delegate to `configureApp`)
- `src/api/common/decorators/current-user-id.decorator.ts` (new)
- `src/api/auth/auth.controller.ts`, `src/api/progress/progress.controller.ts` (adopt `@CurrentUserId`)
- `src/configure-app.ts` (new)
- `test/api/auth/auth.e2e-spec.ts`, `test/api/progress/progress.e2e-spec.ts`, `test/api/levels/levels.e2e-spec.ts` (call `configureApp`; last two also for the ARROW/EMPTY chore)
- `test/infrastructure/persistence/postgres-level.repository.integration-spec.ts` (ARROW/EMPTY chore)
- `src/app.module.ts` (`withLogging`)
**Modifications made by the developer**:
- Set the sub-block cadence and enforced it: one edit, one tsc/tests cycle, one commit, no batching until proven necessary. Nine commits across two sessions, all Conventional, all pushed granularly.
- Diagnosed a VS Code paste-fantasma bug that ate a full edit and burned thirty minutes chasing a stack trace that pointed at the "fixed" line. Recovered by piping the file body through `cat > path << 'EOF' ... EOF` in the terminal — now the fallback whenever a paste's outcome is uncertain.
- When 0.A.8 revealed five e2e failures, refused to move on until we ran `git stash` + retest to isolate whether they were regression or pre-existing debt. They were debt (stash-red, unstash-red), and only then did we commit 0.A.8 and open the chore separately.
- Questioned whether the new param decorator belonged in `application/` alongside `LoggingUseCaseDecorator`. Correct instinct on a real distinction: one is a NestJS param decorator (framework), the other is a GoF Decorator (framework-agnostic). Both files are named `.decorator.ts` but they live in different layers by design.
- Verified each phase against real output before advancing: `git log --oneline`, three-suite tail summaries, `brew services list | grep postgresql`. No claimed-green counts trusted without the Jest banner behind them.
**Lessons learned**:
- **Refactors surface debt for free**. `configureApp` was proposed to remove duplication; running `test:e2e` from `main.ts`'s pipeline for the first time in weeks turned up five failing tests that had been rotting since the cell-model refactor. The refactor paid for itself before the commit landed.
- **Verify at every suite boundary after a domain change**. The previous session's `START/WALL/EXIT → ARROW/EMPTY` refactor updated domain + unit tests +

## Critical evaluation (in progress)

This section will be updated at the end of the project with:
- Approximate percentage of code with AI assistance.
- Notable cases where AI produced incorrect or suboptimal output.
- Team reflection on the impact of AI on productivity and code quality.