/**
 * Input for SubmitScoreUseCase. The userId comes from the verified JWT
 * (attached by the guard), never from the client body — a player can
 * only submit their own progress. The score components describe the run
 * the player just completed.
 */
export interface SubmitScoreCommand {
  userId: string;
  levelId: string;
  moves: number;
  timeMs: number;
  stars: number;
}