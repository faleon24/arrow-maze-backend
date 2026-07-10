import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { DomainExceptionFilter } from './api/filters/domain-exception.filter';
import { LoggingInterceptor } from './api/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS so browser-based clients (the Flutter web app during
  // development, served from a different localhost port) may call the
  // API. Browsers block cross-origin requests unless the server opts in
  // with these headers; non-browser clients like curl are unaffected.
  // In development we allow any origin; a production build would
  // restrict this to the app's real domain.
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

  app.useGlobalInterceptors(new LoggingInterceptor());

  // Hook Node's SIGTERM/SIGINT to Nest's lifecycle so PrismaService's
  // onModuleDestroy runs on a normal shutdown (Ctrl+C in dev, container
  // stop in prod) and the DB connection is closed cleanly. Without this,
  // Nest does not intercept the signals and the process exits before
  // module destructors fire — not a leak (the OS reclaims sockets), but
  // it means half-open transactions from other tenants of the DB may
  // stall until Postgres times them out.
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Arrow Maze API')
    .setDescription(
      'REST API for the Arrow Maze game: authentication, player ' +
        'progress, leaderboards and level definitions.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'User registration and login')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Arrow Maze backend running on http://localhost:${port}/api`);
}

// Explicit .catch() rather than a floating promise: if bootstrap fails
// (JWT_SECRET missing, port in use, DB unreachable, etc.), print the
// error and exit non-zero. Node ≥ 15 exits on unhandled rejections
// anyway, but formalizing this gives us a friendly message and calms
// the no-floating-promises lint that the project already enables.
bootstrap().catch((err) => {
  console.error('Failed to bootstrap Arrow Maze backend:', err);
  process.exit(1);
});