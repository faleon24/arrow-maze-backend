/**
 * Input for SubmitScoreUseCase. The userId comes from the verified JWT
 * (attached by the guard), never from the client body — a player can
 * only submit their own progress. The stars field is deliberately
 * absent: the server grades the run from timeMs and the level's
 * difficulty profile, so the client cannot claim more stars than it
 * earned.
 */
export interface SubmitScoreCommand {
  userId: string;
  levelId: string;
  moves: number;
  timeMs: number;
}