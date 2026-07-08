/**
 * Input DTO for GetUserByIdUseCase. Plain primitive; the use case
 * turns it into domain operations.
 */
export interface GetUserByIdCommand {
  userId: string;
}