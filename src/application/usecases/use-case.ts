/**
 * UseCase<TCommand, TResult> — the common contract every
 * application use case implements.
 *
 * This interface is what makes the Decorator pattern possible: a
 * decorator can wrap ANY use case because it only depends on this
 * shape, not on a concrete class. The decorator implements the
 * same interface, so from the caller's perspective a decorated use
 * case is indistinguishable from a bare one — that is the essence
 * of the Decorator pattern (GoF, structural).
 */
export interface UseCase<TCommand, TResult> {
  execute(command: TCommand): Promise<TResult>;
}