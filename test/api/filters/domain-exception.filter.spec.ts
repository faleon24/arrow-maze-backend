import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';

import { DomainExceptionFilter } from '../../../src/api/filters/domain-exception.filter';
import { EmailAlreadyRegisteredError } from '../../../src/domain/errors/email-already-registered.error';
import { InvalidCredentialsError } from '../../../src/domain/errors/invalid-credentials.error';
import { DomainError } from '../../../src/domain/errors/domain-error';

/**
 * Captures what the filter writes to the HTTP response. Nest's
 * Response uses a fluent API (status().json()), so the fake
 * returns `this` from status() and records the final json payload.
 */
class FakeResponse {
  statusCode: number | null = null;
  body: unknown = null;

  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  json(payload: unknown): this {
    this.body = payload;
    return this;
  }
}

/**
 * Minimal ArgumentsHost that hands back our fake request/response
 * when the filter calls switchToHttp(). Only the methods the
 * filter actually uses are implemented.
 */
function buildHost(
  response: FakeResponse,
  request: { url: string; method: string },
): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: <T>() => response as unknown as T,
      getRequest: <T>() => request as unknown as T,
    }),
  } as unknown as ArgumentsHost;
}

/**
 * A domain error not present in the filter's status map, used to
 * prove the OCP default-branch behaviour (unknown domain errors
 * fall back to 400 rather than 500).
 */
class UnmappedDomainError extends DomainError {
  readonly code = 'UNMAPPED';
  constructor() {
    super('Some unmapped domain condition');
  }
}

describe('DomainExceptionFilter', () => {
  const buildRequest = () => ({
    url: '/api/auth/register',
    method: 'POST',
  });

  describe('domain errors', () => {
    it('should_respond_409_when_email_already_registered_error_is_thrown', () => {
      // Arrange
      const filter = new DomainExceptionFilter();
      const response = new FakeResponse();
      const host = buildHost(response, buildRequest());
      const error = new EmailAlreadyRegisteredError('ana@example.com');

      // Act
      filter.catch(error, host);

      // Assert
      expect(response.statusCode).toBe(HttpStatus.CONFLICT);
    });

    it('should_include_the_domain_error_code_in_the_body_when_a_domain_error_is_thrown', () => {
      // Arrange
      const filter = new DomainExceptionFilter();
      const response = new FakeResponse();
      const host = buildHost(response, buildRequest());
      const error = new EmailAlreadyRegisteredError('ana@example.com');

      // Act
      filter.catch(error, host);

      // Assert
      expect(response.body).toMatchObject({
        statusCode: HttpStatus.CONFLICT,
        code: 'EMAIL_ALREADY_REGISTERED',
        path: '/api/auth/register',
      });
    });

    it('should_respond_401_when_invalid_credentials_error_is_thrown', () => {
      // Arrange
      const filter = new DomainExceptionFilter();
      const response = new FakeResponse();
      const host = buildHost(response, buildRequest());
      const error = new InvalidCredentialsError();

      // Act
      filter.catch(error, host);

      // Assert
      expect(response.statusCode).toBe(HttpStatus.UNAUTHORIZED);
      expect(response.body).toMatchObject({ code: 'INVALID_CREDENTIALS' });
    });

    it('should_default_to_400_when_domain_error_is_not_in_the_status_map', () => {
      // Arrange
      const filter = new DomainExceptionFilter();
      const response = new FakeResponse();
      const host = buildHost(response, buildRequest());
      const error = new UnmappedDomainError();

      // Act
      filter.catch(error, host);

      // Assert
      expect(response.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(response.body).toMatchObject({ code: 'UNMAPPED' });
    });
  });

  describe('Nest HttpException', () => {
    it('should_preserve_status_and_message_when_an_http_exception_is_thrown', () => {
      // Arrange
      const filter = new DomainExceptionFilter();
      const response = new FakeResponse();
      const host = buildHost(response, buildRequest());
      const error = new HttpException('Not Found', HttpStatus.NOT_FOUND);

      // Act
      filter.catch(error, host);

      // Assert
      expect(response.statusCode).toBe(HttpStatus.NOT_FOUND);
      expect(response.body).toMatchObject({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Not Found',
        code: null,
      });
    });

    it('should_join_validation_message_arrays_into_a_single_string', () => {
      // Arrange
      const filter = new DomainExceptionFilter();
      const response = new FakeResponse();
      const host = buildHost(response, buildRequest());
      const error = new HttpException(
        { message: ['email is invalid', 'password too short'] },
        HttpStatus.BAD_REQUEST,
      );

      // Act
      filter.catch(error, host);

      // Assert
      expect(response.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(response.body).toMatchObject({
        message: 'email is invalid; password too short',
      });
    });
  });

  describe('unexpected errors', () => {
    it('should_respond_500_with_a_generic_message_when_an_unknown_error_is_thrown', () => {
      // Arrange
      const filter = new DomainExceptionFilter();
      const response = new FakeResponse();
      const host = buildHost(response, buildRequest());
      const error = new Error('some internal detail that must not leak');

      // Act
      filter.catch(error, host);

      // Assert
      expect(response.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(response.body).toMatchObject({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'An unexpected error occurred',
      });
    });

    it('should_not_leak_the_original_error_message_when_an_unknown_error_is_thrown', () => {
      // Arrange
      const filter = new DomainExceptionFilter();
      const response = new FakeResponse();
      const host = buildHost(response, buildRequest());
      const secret = 'some internal detail that must not leak';
      const error = new Error(secret);

      // Act
      filter.catch(error, host);

      // Assert
      const body = response.body as { message: string };
      expect(body.message).not.toContain(secret);
    });
  });
});