import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

/**
 * LoginDto — HTTP request body for POST /auth/login.
 *
 * Intentionally does NOT enforce a minimum password length here.
 * The registration endpoint owns the "strong password" policy;
 * login only needs a non-empty string so we can compare it
 * against the stored hash. Enforcing MinLength(8) on login would
 * lock out any user whose account predates a future policy
 * change, which is a poor UX and a security anti-pattern
 * (it also leaks the current policy to attackers).
 */
export class LoginDto {
  @IsEmail({}, { message: 'email must be a valid email address' })
  email!: string;

  @IsString({ message: 'password must be a string' })
  @IsNotEmpty({ message: 'password cannot be empty' })
  password!: string;
}