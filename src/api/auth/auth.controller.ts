import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { LoginUseCase } from '../../application/usecases/auth/login.usecase';
import { RegisterUserUseCase } from '../../application/usecases/auth/register-user.usecase';

import { AuthTokenResponseDto } from './dto/auth-token-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterUserDto } from './dto/register-user.dto';

/**
 * AuthController — HTTP entry point for authentication endpoints.
 *
 * This controller is intentionally thin:
 *   1. Receive the validated DTO (ValidationPipe runs first).
 *   2. Translate the DTO into the application-layer command.
 *   3. Delegate to the use case.
 *   4. Map the domain result to the response DTO.
 *
 * No business logic, no try/catch. Error mapping to HTTP status
 * codes lives in the global DomainExceptionFilter, which keeps
 * this controller a pure transport-level adapter. The @ApiResponse
 * decorators document the status codes that filter can produce.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUser: RegisterUserUseCase,
    private readonly login: LoginUseCase,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new user',
    description:
      'Creates an account and returns an authentication token. ' +
      'The email must not already be registered.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Account created; token issued.',
    type: AuthTokenResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation failed (invalid email, weak password, etc.).',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'An account with this email already exists.',
  })
  async register(@Body() dto: RegisterUserDto): Promise<AuthTokenResponseDto> {
    const token = await this.registerUser.execute({
      email: dto.email,
      password: dto.password,
      displayName: dto.displayName,
    });
    return AuthTokenResponseDto.from(token);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Authenticate an existing user',
    description:
      'Verifies credentials and returns an authentication token. ' +
      'Returns 401 for any failure without revealing whether the ' +
      'email or the password was wrong.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Credentials valid; token issued.',
    type: AuthTokenResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation failed (missing or malformed fields).',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid credentials.',
  })
  async loginUser(@Body() dto: LoginDto): Promise<AuthTokenResponseDto> {
    const token = await this.login.execute({
      email: dto.email,
      password: dto.password,
    });
    return AuthTokenResponseDto.from(token);
  }
}