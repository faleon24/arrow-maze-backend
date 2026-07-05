/**
 * Input DTO for LoginUseCase.
 *
 * Plain data-transfer object. The use case is responsible for
 * validating and applying the login flow to these primitives.
 */
export interface LoginCommand {
  email: string;
  password: string;
}