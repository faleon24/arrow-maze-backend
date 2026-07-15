import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DomainExceptionFilter } from './api/filters/domain-exception.filter';

/**
 * configureApp — single source of truth for cross-cutting app config.
 *
 * Both the production bootstrap (main.ts) and the e2e specs call this
 * so tests observe the exact same pipeline as a real client would:
 * CORS → global prefix → ValidationPipe → DomainExceptionFilter →
 * LoggingUseCaseDecorator → shutdown hooks. Before this refactor every
 * e2e spec repeated a partial subset by hand and inevitably drifted
 * (main.ts had the interceptor and CORS; the specs did not). Now
 * every cross-cutting concern lives here — one command, DRY, no drift.
 *
 * Swagger and dotenv loading stay in main.ts: they are boot-only
 * concerns and add zero behaviour worth testing.
 */
export function configureApp(app: INestApplication): void {
  // Browsers block cross-origin requests unless the server opts in.
  // In dev we allow any origin; production restricts by env (Fase 13).
  app.enableCors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new DomainExceptionFilter());
  // SIGTERM/SIGINT → PrismaService.onModuleDestroy → clean DB close.
  app.enableShutdownHooks();
}