import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * RegisterUserDto — HTTP request body for POST /auth/register.
 *
 * This DTO lives in the API layer. It knows about class-validator
 * and JSON, but NOT about the domain. The AuthController is
 * responsible for translating this DTO into a RegisterUserCommand
 * (the application-layer input contract).
 *
 * Validation rules here are the *transport-level* rules. Deeper
 * business rules (e.g. "email must be unique") live in the use
 * case and the domain, and would still fire even if this DTO
 * were replaced by a gRPC or CLI adapter.
 */
export class RegisterUserDto {
  @IsEmail({}, { message: 'email must be a valid email address' })
  email!: string;

  @IsString({ message: 'password must be a string' })
  @MinLength(8, { message: 'password must be at least 8 characters long' })
  @MaxLength(128, { message: 'password must be at most 128 characters long' })
  password!: string;

  @IsString({ message: 'displayName must be a string' })
  @MinLength(1, { message: 'displayName cannot be empty' })
  @MaxLength(50, { message: 'displayName must be at most 50 characters long' })
  displayName!: string;
}