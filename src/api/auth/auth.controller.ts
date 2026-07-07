import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { LoginUseCase } from '../../application/usecases/auth/login.usecase';
import { RegisterUserUseCase } from '../../application/usecases/auth/register-user.usecase';

import { AuthTokenResponseDto } from './dto/auth-token-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterUserDto } from './dto/register-user.dto';

/**
 * AuthController — HTTP entry point for authentication endpoints.
 *
 * This controller is intentionally thin:
 *   1. Receive the validated DTO (ValidationPipe runs before this
 *      method is called).
 *   2. Translate the DTO into the application-layer command.
 *   3. Delegate to the use case.
 *   4. Map the domain result to the response DTO.
 *
 * No business logic, no try/catch, no direct access to
 * repositories or hashers. Error mapping to HTTP status codes
 * lives in a global exception filter (added in the next block),
 * which keeps this controller a pure transport-level adapter.
 *
 * DIP: depends on use case classes as *abstractions from the
 * application layer's perspective*. Nest resolves them from
 * AppModule, which is the only place that knows the concrete
 * outbound adapters wired behind them.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUser: RegisterUserUseCase,
    private readonly login: LoginUseCase,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
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
  async loginUser(@Body() dto: LoginDto): Promise<AuthTokenResponseDto> {
    const token = await this.login.execute({
      email: dto.email,
      password: dto.password,
    });
    return AuthTokenResponseDto.from(token);
  }
}