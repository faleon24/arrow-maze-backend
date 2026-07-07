import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

/**
 * LoginDto — HTTP request body for POST /auth/login.
 *
 * Intentionally does NOT enforce a minimum password length here.
 * The registration endpoint owns the "strong password" policy;
 * login only needs a non-empty string so we can compare it
 * against the stored hash. Enforcing MinLength(8) on login would
 * lock out any user whose account predates a future policy
 * change, and it would leak the current policy to attackers.
 */
export class LoginDto {
  @ApiProperty({
    description: 'Email address the account was registered with.',
    example: 'player@example.com',
    format: 'email',
  })
  @IsEmail({}, { message: 'email must be a valid email address' })
  email!: string;

  @ApiProperty({
    description: 'Account password.',
    example: 'a-strong-password',
  })
  @IsString({ message: 'password must be a string' })
  @IsNotEmpty({ message: 'password cannot be empty' })
  password!: string;
}