import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AdminKeyGuard } from '../../../src/api/guards/admin-key.guard';

/**
 * Unit tests for AdminKeyGuard. The guard has no injected deps, so a
 * fake ExecutionContext is enough — we don't need a Nest testing
 * module.
 */
describe('AdminKeyGuard', () => {
  const ORIGINAL_ENV = process.env;
  let guard: AdminKeyGuard;

  const contextWith = (header: string | undefined): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          header: (name: string) =>
            name.toLowerCase() === 'x-admin-key' ? header : undefined,
        }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    guard = new AdminKeyGuard();
    process.env = { ...ORIGINAL_ENV, ADMIN_API_KEY: 'secret-key-123' };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('should_allow_when_header_matches_env_key', () => {
    expect(guard.canActivate(contextWith('secret-key-123'))).toBe(true);
  });

  it('should_reject_with_401_when_header_is_missing', () => {
    expect(() => guard.canActivate(contextWith(undefined))).toThrow(
      UnauthorizedException,
    );
  });

  it('should_reject_with_401_when_header_does_not_match', () => {
    expect(() => guard.canActivate(contextWith('wrong-key'))).toThrow(
      UnauthorizedException,
    );
  });

  it('should_reject_when_header_is_a_prefix_of_env_key', () => {
    // The timing-safe check still fails on a shorter prefix — otherwise
    // an attacker could probe the key one character at a time.
    expect(() => guard.canActivate(contextWith('secret'))).toThrow(
      UnauthorizedException,
    );
  });

  it('should_throw_when_env_key_is_not_configured', () => {
    delete process.env.ADMIN_API_KEY;
    expect(() => guard.canActivate(contextWith('any-key'))).toThrow(
      /ADMIN_API_KEY/,
    );
  });
});