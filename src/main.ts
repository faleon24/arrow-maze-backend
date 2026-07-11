import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Shared cross-cutting config (CORS, prefix, validation, filter,
  // interceptor, shutdown hooks) lives in configureApp so e2e specs
  // boot the exact same pipeline as production.
  configureApp(app);

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