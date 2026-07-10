import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
/**
 * RegisterUserDto — HTTP request body for POST /auth/register.
 *
 * This DTO lives in the API layer. It knows about class-validator
 * and JSON, but NOT about the domain. The AuthController is
 * responsible for translating this DTO into a RegisterUserCommand
 * (the application-layer input contract).
 *
 * The @ApiProperty decorators feed the OpenAPI schema from the
 * same class that drives runtime validation, so the documented
 * contract can never drift from the enforced one.
 */
export class RegisterUserDto {
  @ApiProperty({
    description: 'Email address that will identify the account.',
    example: 'player@example.com',
    format: 'email',
  })
  @IsEmail({}, { message: 'email must be a valid email address' })
  email!: string;

  @ApiProperty({
    description: 'Plain-text password. Hashed server-side; never stored raw.',
    example: 'a-strong-password',
    minLength: 8,
    maxLength: 128,
  })
  @IsString({ message: 'password must be a string' })
  @MinLength(8, { message: 'password must be at least 8 characters long' })
  @MaxLength(128, { message: 'password must be at most 128 characters long' })
  password!: string;

  @ApiProperty({
    description: 'Public display name shown on leaderboards.',
    example: 'ArrowMaster',
    minLength: 1,
    maxLength: 50,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @Matches(/\S/, { message: 'displayName cannot be blank' })
  displayName!: string;
}