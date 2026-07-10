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
bootstrap();