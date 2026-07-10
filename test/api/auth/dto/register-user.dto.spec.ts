import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterUserDto } from '../../../../src/api/auth/dto/register-user.dto';

/**
 * Unit tests for the RegisterUserDto validation rules.
 *
 * These live at the HTTP boundary — they document what the API rejects
 * with a 400 before requests reach the use case. Tests for the use-case
 * level defense (e.g. `User` throwing on empty display name) live in
 * `register-user.usecase.spec.ts` and remain untouched.
 */
describe('RegisterUserDto', () => {
  const valid = {
    email: 'ana@example.com',
    password: 'password123',
    displayName: 'Ana',
  };

  it('should_pass_validation_when_all_fields_are_valid', async () => {
    const dto = plainToInstance(RegisterUserDto, valid);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should_reject_when_displayName_is_only_whitespace', async () => {
    const dto = plainToInstance(RegisterUserDto, {
      ...valid,
      displayName: '   ',
    });
    const errors = await validate(dto);
    const displayNameError = errors.find((e) => e.property === 'displayName');
    expect(displayNameError).toBeDefined();
    expect(displayNameError!.constraints).toHaveProperty('matches');
  });

  it('should_reject_when_email_format_is_invalid', async () => {
    const dto = plainToInstance(RegisterUserDto, {
      ...valid,
      email: 'not-an-email',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('should_reject_when_password_is_missing', async () => {
    const dto = plainToInstance(RegisterUserDto, {
      email: valid.email,
      displayName: valid.displayName,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });
});