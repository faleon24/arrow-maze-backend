/**
 * Input DTO for RegisterUserUseCase.
 *
 * This is a plain data-transfer object: no methods, no validation.
 * The use case is responsible for validating and transforming
 * these primitives into domain value objects.
 */
export interface RegisterUserCommand {
  email: string;
  password: string;
  displayName: string;
}