import { ExecutionContext } from '@nestjs/common';

import { JwtAuthGuard } from '../../../src/api/guards/jwt-auth.guard';
import { InvalidTokenError } from '../../../src/domain/errors/invalid-token.error';
import { ITokenService } from '../../../src/application/ports/out/token-service.port';
import { AuthToken } from '../../../src/domain/models/auth-token';

/**
 * Hand-written fake for ITokenService. Records the token it was
 * asked to verify and returns a preset userId, or throws if
 * configured to simulate an invalid token.
 */
class FakeTokenService implements ITokenService {
  lastVerified: string | null = null;
  userIdToReturn = 'user-123';
  shouldThrowOnVerify = false;

  async issue(): Promise<AuthToken> {
    // Not used by the guard; present to satisfy the interface.
    return new AuthToken('unused', new Date('2099-01-01T00:00:00.000Z'));
  }

  async verify(rawToken: string): Promise<string> {
    this.lastVerified = rawToken;
    if (this.shouldThrowOnVerify) {
      throw new Error('invalid token');
    }
    return this.userIdToReturn;
  }
}

/**
 * Builds a fake ExecutionContext whose request has the given
 * authorization header. The request object is returned so tests
 * can inspect whether the guard attached userId to it.
 */
function buildContext(authorization?: string): {
  context: ExecutionContext;
  request: Record<string, unknown>;
} {
  const request: Record<string, unknown> = {
    headers: authorization === undefined ? {} : { authorization },
  };
  const context = {
    switchToHttp: () => ({
      getRequest: <T>() => request as unknown as T,
    }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('JwtAuthGuard', () => {
  it('should_return_true_and_attach_userId_when_token_is_valid', async () => {
    // Arrange
    const tokens = new FakeTokenService();
    tokens.userIdToReturn = 'user-abc';
    const guard = new JwtAuthGuard(tokens);
    const { context, request } = buildContext('Bearer valid.jwt.token');

    // Act
    const result = await guard.canActivate(context);

    // Assert
    expect(result).toBe(true);
    expect(request.userId).toBe('user-abc');
    expect(tokens.lastVerified).toBe('valid.jwt.token');
  });

  it('should_throw_InvalidTokenError_when_authorization_header_is_missing', async () => {
    // Arrange
    const tokens = new FakeTokenService();
    const guard = new JwtAuthGuard(tokens);
    const { context } = buildContext(undefined);

    // Act
    const act = () => guard.canActivate(context);

    // Assert
    await expect(act).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it('should_throw_InvalidTokenError_when_scheme_is_not_Bearer', async () => {
    // Arrange
    const tokens = new FakeTokenService();
    const guard = new JwtAuthGuard(tokens);
    const { context } = buildContext('Basic dXNlcjpwYXNz');

    // Act
    const act = () => guard.canActivate(context);

    // Assert
    await expect(act).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it('should_throw_InvalidTokenError_when_token_verification_fails', async () => {
    // Arrange
    const tokens = new FakeTokenService();
    tokens.shouldThrowOnVerify = true;
    const guard = new JwtAuthGuard(tokens);
    const { context } = buildContext('Bearer expired.or.bad');

    // Act
    const act = () => guard.canActivate(context);

    // Assert
    await expect(act).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it('should_not_attach_userId_when_token_is_invalid', async () => {
    // Arrange
    const tokens = new FakeTokenService();
    tokens.shouldThrowOnVerify = true;
    const guard = new JwtAuthGuard(tokens);
    const { context, request } = buildContext('Bearer bad');

    // Act
    try {
      await guard.canActivate(context);
    } catch {
      // expected
    }

    // Assert
    expect(request.userId).toBeUndefined();
  });
});