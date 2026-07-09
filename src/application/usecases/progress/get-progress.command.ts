/**
 * Input for GetProgressUseCase. Only the authenticated user's id,
 * supplied by the guard from the verified token.
 */
export interface GetProgressCommand {
  userId: string;
}