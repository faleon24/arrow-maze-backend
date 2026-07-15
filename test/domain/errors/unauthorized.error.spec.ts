import { UnauthorizedError } from '../../../src/domain/errors/unauthorized.error';
import { DomainError } from '../../../src/domain/errors/domain-error';

describe('UnauthorizedError', () => {
  it('should_be_a_DomainError', () => {
    expect(new UnauthorizedError()).toBeInstanceOf(DomainError);
  });

  it('should_expose_a_stable_UNAUTHORIZED_code', () => {
    expect(new UnauthorizedError().code).toBe('UNAUTHORIZED');
  });

  it('should_carry_a_human_readable_message', () => {
    expect(new UnauthorizedError().message).toMatch(/authentication/i);
  });
});
