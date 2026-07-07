import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';

import { AppModule } from '../../../src/app.module';
import { DomainExceptionFilter } from '../../../src/api/filters/domain-exception.filter';
import { PrismaService } from '../../../src/infrastructure/persistence/prisma.service';
import { DatabaseCleaner } from '../../infrastructure/helpers/database-cleaner';

/**
 * End-to-end tests for the authentication endpoints.
 *
 * Unlike the repository integration test (which exercises one
 * adapter against Postgres), these tests boot the ENTIRE Nest
 * application and drive it over HTTP with supertest. Every layer
 * participates: ValidationPipe -> AuthController -> use case ->
 * BcryptPasswordHasher -> PostgresUserRepository -> JwtTokenService
 * -> DomainExceptionFilter.
 *
 * The app is configured here exactly as in main.ts (global prefix,
 * validation pipe, exception filter) so the tests see the same
 * behaviour a real client would. Swagger is omitted because it
 * adds no behaviour under test.
 *
 * Safety: the shared jest-integration.setup.ts guard refuses to
 * run unless DATABASE_URL points at arrowmaze_test, so these
 * destructive tests can never touch the dev database.
 */
describe('Auth endpoints (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cleaner: DatabaseCleaner;

  const registerPayload = {
    email: 'e2e@example.com',
    password: 'a-strong-password',
    displayName: 'E2E Tester',
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();

    // Mirror main.ts so the app under test behaves like production.
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new DomainExceptionFilter());

    await app.init();

    prisma = moduleRef.get(PrismaService);
    cleaner = new DatabaseCleaner(prisma as unknown as PrismaClient);
  });

  afterEach(async () => {
    await cleaner.cleanAll();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/auth/register', () => {
    it('should_return_201_with_a_token_when_payload_is_valid', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(registerPayload);

      // Assert
      expect(response.status).toBe(201);
      expect(typeof response.body.token).toBe('string');
      expect(response.body.token.length).toBeGreaterThan(0);
      expect(typeof response.body.expiresAt).toBe('string');
    });

    it('should_return_400_when_email_is_invalid', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ ...registerPayload, email: 'not-an-email' });

      // Assert
      expect(response.status).toBe(400);
    });

    it('should_return_400_when_password_is_too_short', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ ...registerPayload, password: 'short' });

      // Assert
      expect(response.status).toBe(400);
    });

    it('should_return_409_when_email_is_already_registered', async () => {
      // Arrange
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(registerPayload);

      // Act
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(registerPayload);

      // Assert
      expect(response.status).toBe(409);
      expect(response.body.code).toBe('EMAIL_ALREADY_REGISTERED');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should_return_200_with_a_token_when_credentials_are_valid', async () => {
      // Arrange
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(registerPayload);

      // Act
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: registerPayload.email,
          password: registerPayload.password,
        });

      // Assert
      expect(response.status).toBe(200);
      expect(typeof response.body.token).toBe('string');
    });

    it('should_return_401_when_password_is_wrong', async () => {
      // Arrange
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(registerPayload);

      // Act
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: registerPayload.email, password: 'wrong-password' });

      // Assert
      expect(response.status).toBe(401);
      expect(response.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('should_return_401_when_email_is_not_registered', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'nobody@example.com', password: 'a-strong-password' });

      // Assert
      expect(response.status).toBe(401);
      expect(response.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('should_return_the_same_401_for_unknown_email_and_wrong_password', async () => {
      // Arrange
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(registerPayload);

      // Act
      const unknownEmail = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'ghost@example.com', password: 'a-strong-password' });
      const wrongPassword = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: registerPayload.email, password: 'wrong-password' });

      // Assert — both paths are indistinguishable to a caller.
      expect(unknownEmail.status).toBe(401);
      expect(wrongPassword.status).toBe(401);
      expect(unknownEmail.body.message).toBe(wrongPassword.body.message);
      expect(unknownEmail.body.code).toBe(wrongPassword.body.code);
    });
  });
});