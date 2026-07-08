import { AuthToken } from '../../../src/domain/models/auth-token';
import { AuthController } from '../../../src/api/auth/auth.controller';
import { AuthTokenResponseDto } from '../../../src/api/auth/dto/auth-token-response.dto';
import { LoginDto } from '../../../src/api/auth/dto/login.dto';
import { LoginCommand } from '../../../src/application/usecases/auth/login.command';
import { LoginUseCase } from '../../../src/application/usecases/auth/login.usecase';
import { RegisterUserCommand } from '../../../src/application/usecases/auth/register-user.command';
import { RegisterUserDto } from '../../../src/api/auth/dto/register-user.dto';
import { RegisterUserUseCase } from '../../../src/application/usecases/auth/register-user.usecase';
import { GetUserByIdUseCase } from '../../../src/application/usecases/auth/get-user-by-id.usecase';
import { User } from '../../../src/domain/models/user';
import { Email } from '../../../src/domain/models/email';
import { PasswordHash } from '../../../src/domain/models/password-hash';


/**
 * Hand-written fake for RegisterUserUseCase.
 *
 * Records the last command it received and returns a preset
 * token. Throws a preset error if configured to do so, which
 * lets us verify the controller propagates errors without
 * swallowing them (the global exception filter, added later,
 * is what turns them into HTTP responses).
 */
class FakeRegisterUserUseCase {
  lastCommand: RegisterUserCommand | null = null;
  tokenToReturn: AuthToken = new AuthToken(
    'fake-register-token',
    new Date('2099-12-31T23:59:59.000Z'),
  );
  errorToThrow: Error | null = null;

  async execute(command: RegisterUserCommand): Promise<AuthToken> {
    this.lastCommand = command;
    if (this.errorToThrow !== null) {
      throw this.errorToThrow;
    }
    return this.tokenToReturn;
  }
}

/**
 * Hand-written fake for LoginUseCase. Same shape as the register
 * fake, kept as a separate class so the intent of each test
 * remains explicit.
 */
class FakeLoginUseCase {
  lastCommand: LoginCommand | null = null;
  tokenToReturn: AuthToken = new AuthToken(
    'fake-login-token',
    new Date('2099-12-31T23:59:59.000Z'),
  );
  errorToThrow: Error | null = null;

  async execute(command: LoginCommand): Promise<AuthToken> {
    this.lastCommand = command;
    if (this.errorToThrow !== null) {
      throw this.errorToThrow;
    }
    return this.tokenToReturn;
  }
}

/**
 * Hand-written fake for GetUserByIdUseCase. Returns a preset User
 * (or throws) so the controller's /me handler can be tested in
 * isolation. The register/login tests do not exercise /me, but the
 * controller constructor now requires this dependency, so every
 * test supplies the fake.
 */
class FakeGetUserByIdUseCase {
  userToReturn: User = new User({
    id: 'fake-user-id',
    email: new Email('me@example.com'),
    passwordHash: new PasswordHash(
      '$2b$04$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQR',
    ),
    displayName: 'Fake User',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  });
  errorToThrow: Error | null = null;

  async execute(): Promise<User> {
    if (this.errorToThrow !== null) {
      throw this.errorToThrow;
    }
    return this.userToReturn;
  }
}

function buildValidRegisterDto(): RegisterUserDto {
  const dto = new RegisterUserDto();
  dto.email = 'alice@example.com';
  dto.password = 'a-strong-password';
  dto.displayName = 'Alice';
  return dto;
}

function buildValidLoginDto(): LoginDto {
  const dto = new LoginDto();
  dto.email = 'alice@example.com';
  dto.password = 'a-strong-password';
  return dto;
}

describe('AuthController', () => {
  describe('register', () => {
    it('should_forward_dto_fields_to_the_register_use_case_command', async () => {
      // Arrange
      const registerUseCase = new FakeRegisterUserUseCase();
      const loginUseCase = new FakeLoginUseCase();
      const getUserByIdUseCase = new FakeGetUserByIdUseCase();
      const controller = new AuthController(
        registerUseCase as unknown as RegisterUserUseCase,
        loginUseCase as unknown as LoginUseCase,
        getUserByIdUseCase as unknown as GetUserByIdUseCase,
      );
      const dto = buildValidRegisterDto();

      // Act
      await controller.register(dto);

      // Assert
      expect(registerUseCase.lastCommand).toEqual({
        email: 'alice@example.com',
        password: 'a-strong-password',
        displayName: 'Alice',
      });
    });

    it('should_return_a_response_dto_built_from_the_use_case_token_when_registration_succeeds', async () => {
      // Arrange
      const registerUseCase = new FakeRegisterUserUseCase();
      registerUseCase.tokenToReturn = new AuthToken(
        'issued-token-abc',
        new Date('2030-01-15T10:00:00.000Z'),
      );
      const loginUseCase = new FakeLoginUseCase();
      const getUserByIdUseCase = new FakeGetUserByIdUseCase();
      const controller = new AuthController(
        registerUseCase as unknown as RegisterUserUseCase,
        loginUseCase as unknown as LoginUseCase,
        getUserByIdUseCase as unknown as GetUserByIdUseCase,
      );

      // Act
      const response = await controller.register(buildValidRegisterDto());

      // Assert
      expect(response).toBeInstanceOf(AuthTokenResponseDto);
      expect(response.token).toBe('issued-token-abc');
      expect(response.expiresAt).toBe('2030-01-15T10:00:00.000Z');
    });

    it('should_propagate_errors_thrown_by_the_register_use_case', async () => {
      // Arrange
      const registerUseCase = new FakeRegisterUserUseCase();
      registerUseCase.errorToThrow = new Error(
        'An account with this email already exists',
      );
      const loginUseCase = new FakeLoginUseCase();
      const getUserByIdUseCase = new FakeGetUserByIdUseCase();
      const controller = new AuthController(
        registerUseCase as unknown as RegisterUserUseCase,
        loginUseCase as unknown as LoginUseCase,
        getUserByIdUseCase as unknown as GetUserByIdUseCase,
      );

      // Act
      const act = () => controller.register(buildValidRegisterDto());

      // Assert
      await expect(act).rejects.toThrow(
        'An account with this email already exists',
      );
    });

    it('should_not_invoke_the_login_use_case_when_registering', async () => {
      // Arrange
      const registerUseCase = new FakeRegisterUserUseCase();
      const loginUseCase = new FakeLoginUseCase();
      const getUserByIdUseCase = new FakeGetUserByIdUseCase();
      const controller = new AuthController(
        registerUseCase as unknown as RegisterUserUseCase,
        loginUseCase as unknown as LoginUseCase,
        getUserByIdUseCase as unknown as GetUserByIdUseCase,
      );

      // Act
      await controller.register(buildValidRegisterDto());

      // Assert
      expect(loginUseCase.lastCommand).toBeNull();
    });
  });

  describe('loginUser', () => {
    it('should_forward_dto_fields_to_the_login_use_case_command', async () => {
      // Arrange
      const registerUseCase = new FakeRegisterUserUseCase();
      const loginUseCase = new FakeLoginUseCase();
      const getUserByIdUseCase = new FakeGetUserByIdUseCase();
      const controller = new AuthController(
        registerUseCase as unknown as RegisterUserUseCase,
        loginUseCase as unknown as LoginUseCase,
        getUserByIdUseCase as unknown as GetUserByIdUseCase,
      );
      const dto = buildValidLoginDto();

      // Act
      await controller.loginUser(dto);

      // Assert
      expect(loginUseCase.lastCommand).toEqual({
        email: 'alice@example.com',
        password: 'a-strong-password',
      });
    });

    it('should_return_a_response_dto_built_from_the_use_case_token_when_login_succeeds', async () => {
      // Arrange
      const registerUseCase = new FakeRegisterUserUseCase();
      const loginUseCase = new FakeLoginUseCase();
      const getUserByIdUseCase = new FakeGetUserByIdUseCase();
      loginUseCase.tokenToReturn = new AuthToken(
        'session-token-xyz',
        new Date('2030-06-01T00:00:00.000Z'),
      );
      const controller = new AuthController(
        registerUseCase as unknown as RegisterUserUseCase,
        loginUseCase as unknown as LoginUseCase,
        getUserByIdUseCase as unknown as GetUserByIdUseCase,
      );

      // Act
      const response = await controller.loginUser(buildValidLoginDto());

      // Assert
      expect(response).toBeInstanceOf(AuthTokenResponseDto);
      expect(response.token).toBe('session-token-xyz');
      expect(response.expiresAt).toBe('2030-06-01T00:00:00.000Z');
    });

    it('should_propagate_errors_thrown_by_the_login_use_case', async () => {
      // Arrange
      const registerUseCase = new FakeRegisterUserUseCase();
      const loginUseCase = new FakeLoginUseCase();
      const getUserByIdUseCase = new FakeGetUserByIdUseCase();
      loginUseCase.errorToThrow = new Error('Invalid credentials');
      const controller = new AuthController(
        registerUseCase as unknown as RegisterUserUseCase,
        loginUseCase as unknown as LoginUseCase,
        getUserByIdUseCase as unknown as GetUserByIdUseCase,
      );

      // Act
      const act = () => controller.loginUser(buildValidLoginDto());

      // Assert
      await expect(act).rejects.toThrow('Invalid credentials');
    });

    it('should_not_invoke_the_register_use_case_when_logging_in', async () => {
      // Arrange
      const registerUseCase = new FakeRegisterUserUseCase();
      const loginUseCase = new FakeLoginUseCase();
      const getUserByIdUseCase = new FakeGetUserByIdUseCase();
      const controller = new AuthController(
        registerUseCase as unknown as RegisterUserUseCase,
        loginUseCase as unknown as LoginUseCase,
        getUserByIdUseCase as unknown as GetUserByIdUseCase,
      );

      // Act
      await controller.loginUser(buildValidLoginDto());

      // Assert
      expect(registerUseCase.lastCommand).toBeNull();
    });
  });
});