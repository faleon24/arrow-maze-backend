import { Module, Logger } from '@nestjs/common';
import { GetUserByIdUseCase } from './application/usecases/auth/get-user-by-id.usecase';
import { LoggingUseCaseDecorator } from './application/decorators/logging-use-case.decorator';
import { UseCase } from './application/usecases/use-case';
// Injection tokens (application layer contract)
import {
  USER_REPOSITORY,
  PASSWORD_HASHER,
  TOKEN_SERVICE,
  CLOCK,
  ID_GENERATOR,
  LEVEL_REPOSITORY,
  PROGRESS_REPOSITORY,
} from './application/ports/tokens';
// Application layer — use cases (framework-agnostic)
import { RegisterUserUseCase } from './application/usecases/auth/register-user.usecase';
import { LoginUseCase } from './application/usecases/auth/login.usecase';
import { ListLevelsUseCase } from './application/usecases/levels/list-levels.usecase';
import { SubmitScoreUseCase } from './application/usecases/progress/submit-score.usecase';
import { GetProgressUseCase } from './application/usecases/progress/get-progress.usecase';
// Application layer — port interfaces (only for typing the factory params)
import { IUserRepository } from './application/ports/out/user-repository.port';
import { IPasswordHasher } from './application/ports/out/password-hasher.port';
import { ITokenService } from './application/ports/out/token-service.port';
import { IClock } from './application/ports/out/clock.port';
import { IIdGenerator } from './application/ports/out/id-generator.port';
import { ILevelRepository } from './application/ports/out/level-repository.port';
import { IProgressRepository } from './application/ports/out/progress-repository.port';
// Infrastructure layer — concrete adapters
import { PrismaService } from './infrastructure/persistence/prisma.service';
import { PostgresUserRepository } from './infrastructure/persistence/postgres-user.repository';
import { PostgresLevelRepository } from './infrastructure/persistence/postgres-level.repository';
import { PostgresProgressRepository } from './infrastructure/persistence/postgres-progress.repository';
import { BcryptPasswordHasher } from './infrastructure/security/bcrypt-password-hasher';
import { JwtTokenService } from './infrastructure/security/jwt-token-service';
import { SystemClock } from './infrastructure/system/system-clock';
import { UuidGenerator } from './infrastructure/system/uuid-generator';
// API layer — REST controllers
import { AuthController } from './api/auth/auth.controller';
import { LevelsController } from './api/levels/levels.controller';
import { ProgressController } from './api/progress/progress.controller';
import { JwtAuthGuard } from './api/guards/jwt-auth.guard';
/**
 * AppModule is the composition root of the application.
 *
 * This is the ONLY file in the project that knows about concrete
 * implementations of the outbound ports. Every other layer talks to
 * interfaces (via injection tokens), and Nest resolves them here.
 *
 * The application layer (use cases) contains zero Nest imports. Use cases
 * are wired via useFactory rather than @Injectable decorators, keeping
 * them portable to any framework or runtime.
 */
/**
 * Parses a human-friendly duration string ("7d", "1h", "3600s") into
 * seconds. Kept as a local helper so JwtTokenService can stay a pure
 * value receiver — parsing lives at the composition root, where env
 * strings are turned into typed values.
 */
function parseExpiresIn(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) {
    throw new Error(
      `Invalid JWT_EXPIRES_IN value: "${value}". Expected format like "7d","1h", "3600s".`,
    );
  }
  const amount = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return amount * multipliers[unit];
}
/**
 * withLogging — wraps a use case in the LoggingUseCaseDecorator with
 * a per-name Nest logger. Collapses six identical inline blocks in
 * the providers array below into a single call site: the AOP wiring
 * (which logger, which name) lives in one place instead of six, so
 * a future change (say, swap for a structured logger, or add a metrics
 * decorator on top) touches this helper and nothing else. That is OCP
 * applied to the composition root itself.
 *
 * Generic in <C, R> so TypeScript preserves each use case's command
 * and result types through the wrap — the returned UseCase is still
 * strongly typed, not any/unknown.
 */
function withLogging<C, R>(uc: UseCase<C, R>, name: string): UseCase<C, R> {
  return new LoggingUseCaseDecorator(uc, name, new Logger('UseCase'));
}
@Module({
  controllers: [AuthController, LevelsController, ProgressController],

  providers: [
    // ------------------------------------------------------------------
    // Infrastructure: Prisma
    // ------------------------------------------------------------------
    PrismaService,
    // ------------------------------------------------------------------
    // Outbound port adapters — one per port, bound by its injection token
    // ------------------------------------------------------------------
    {
      provide: USER_REPOSITORY,
      useClass: PostgresUserRepository,
    },
    {
      provide: PASSWORD_HASHER,
      useClass: BcryptPasswordHasher,
    },
    {
      provide: LEVEL_REPOSITORY,
      useClass: PostgresLevelRepository,
    },
    {
      provide: PROGRESS_REPOSITORY,
      useFactory: (prisma: PrismaService, ids: IIdGenerator) => {
        return new PostgresProgressRepository(prisma, ids);
      },
      inject: [PrismaService, ID_GENERATOR],
    },
    {
      provide: SubmitScoreUseCase,
      useFactory: (
        progress: IProgressRepository,
        clock: IClock,
        levels: ILevelRepository,
      ) =>
        withLogging(
          new SubmitScoreUseCase(progress, clock, levels),
          'SubmitScoreUseCase',
        ),
      inject: [PROGRESS_REPOSITORY, CLOCK, LEVEL_REPOSITORY],
    },
    {
      provide: GetProgressUseCase,
      useFactory: (progress: IProgressRepository) =>
        withLogging(new GetProgressUseCase(progress), 'GetProgressUseCase'),
      inject: [PROGRESS_REPOSITORY],
    },
    {
      provide: ListLevelsUseCase,
      useFactory: (levels: ILevelRepository) =>
        withLogging(new ListLevelsUseCase(levels), 'ListLevelsUseCase'),
      inject: [LEVEL_REPOSITORY],
    },
    {
      provide: GetUserByIdUseCase,
      useFactory: (users: IUserRepository) =>
        withLogging(new GetUserByIdUseCase(users), 'GetUserByIdUseCase'),
      inject: [USER_REPOSITORY],
    },
    // ------------------------------------------------------------------
    // API layer — guards (the JWT authentication aspect)
    // ------------------------------------------------------------------
    JwtAuthGuard,
    {
      provide: TOKEN_SERVICE,
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        const expiresIn = process.env.JWT_EXPIRES_IN;
        if (!secret) {
          throw new Error(
            'JWT_SECRET is not defined. Check that .env is loaded before AppModule instantiates providers.',
          );
        }
        // JWT_EXPIRES_IN in the .env is a human-friendly string like "7d".
        // JwtTokenService expects a number of seconds. Convert here so the
        // adapter stays a dumb, deterministic value receiver.
        const expiresInSeconds = parseExpiresIn(expiresIn ?? '7d');
        return new JwtTokenService(secret, expiresInSeconds);
      },
    },
    {
      provide: CLOCK,
      useClass: SystemClock,
    },
    {
      provide: ID_GENERATOR,
      useClass: UuidGenerator,
    },
    // ------------------------------------------------------------------
    // Application use cases — wired via factory so they stay
    // Nest-agnostic. Parameter order MUST match each use case's
    // constructor signature exactly.
    // ------------------------------------------------------------------
    {
      provide: RegisterUserUseCase,
      useFactory: (
        users: IUserRepository,
        hasher: IPasswordHasher,
        tokens: ITokenService,
        clock: IClock,
        ids: IIdGenerator,
      ) =>
        withLogging(
          new RegisterUserUseCase(users, hasher, tokens, clock, ids),
          'RegisterUserUseCase',
        ),
      inject: [
        USER_REPOSITORY,
        PASSWORD_HASHER,
        TOKEN_SERVICE,
        CLOCK,
        ID_GENERATOR,
      ],
    },
    {
      provide: LoginUseCase,
      useFactory: (
        users: IUserRepository,
        hasher: IPasswordHasher,
        tokens: ITokenService,
      ) =>
        withLogging(
          new LoginUseCase(users, hasher, tokens),
          'LoginUseCase',
        ),
      inject: [USER_REPOSITORY, PASSWORD_HASHER, TOKEN_SERVICE],
    },
  ],
  exports: [RegisterUserUseCase, LoginUseCase, GetUserByIdUseCase],
})
export class AppModule {}