/**
 * Input for ListLevelsUseCase.
 *
 * Listing the published catalog takes no parameters today. We still
 * model an explicit (empty) command so the use case conforms to the
 * same UseCase<TCommand, TResult> shape as every other one — which is
 * exactly what lets the LoggingUseCaseDecorator wrap it uniformly.
 * When pagination or filtering arrives, it lands here without changing
 * the use case's signature.
 */
export interface ListLevelsCommand {}