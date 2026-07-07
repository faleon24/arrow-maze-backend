import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Observable, of, throwError } from 'rxjs';

import { LoggingInterceptor } from '../../../src/api/interceptors/logging.interceptor';

/**
 * Builds a fake ExecutionContext whose switchToHttp() returns the
 * given request/response. Only the members the interceptor calls
 * are implemented.
 */
function buildContext(
  request: { method: string; url: string },
  response: { statusCode: number },
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: <T>() => request as unknown as T,
      getResponse: <T>() => response as unknown as T,
    }),
  } as unknown as ExecutionContext;
}

/**
 * Fake CallHandler whose handle() returns a preset observable,
 * standing in for the downstream route handler.
 */
class FakeCallHandler implements CallHandler {
  constructor(private readonly stream: Observable<unknown>) {}
  handle(): Observable<unknown> {
    return this.stream;
  }
}

describe('LoggingInterceptor', () => {
  const request = { method: 'POST', url: '/api/auth/login' };
  const response = { statusCode: 200 };

  it('should_pass_through_the_handler_value_on_success', (done) => {
    // Arrange
    const interceptor = new LoggingInterceptor();
    const context = buildContext(request, response);
    const handler = new FakeCallHandler(of({ token: 'abc' }));

    // Act
    const result$ = interceptor.intercept(context, handler);

    // Assert — the interceptor must not alter the emitted value.
    result$.subscribe({
      next: (value) => {
        expect(value).toEqual({ token: 'abc' });
      },
      complete: () => done(),
    });
  });

  it('should_log_entry_and_exit_on_a_successful_request', (done) => {
    // Arrange
    const interceptor = new LoggingInterceptor();
    const context = buildContext(request, response);
    const handler = new FakeCallHandler(of('ok'));
    const logSpy = jest
      .spyOn(interceptor['logger'], 'log')
      .mockImplementation(() => undefined);

    // Act
    const result$ = interceptor.intercept(context, handler);

    // Assert
    result$.subscribe({
      complete: () => {
        // One "before" log and one "after" log.
        expect(logSpy).toHaveBeenCalledTimes(2);
        expect(logSpy.mock.calls[0][0]).toContain('--> POST /api/auth/login');
        expect(logSpy.mock.calls[1][0]).toContain('<-- POST /api/auth/login');
        logSpy.mockRestore();
        done();
      },
    });
  });

  it('should_log_a_warning_and_rethrow_when_the_handler_errors', (done) => {
    // Arrange
    const interceptor = new LoggingInterceptor();
    const context = buildContext(request, response);
    const failure = new Error('boom');
    const handler = new FakeCallHandler(throwError(() => failure));
    const warnSpy = jest
      .spyOn(interceptor['logger'], 'warn')
      .mockImplementation(() => undefined);

    // Act
    const result$ = interceptor.intercept(context, handler);

    // Assert — the error must still propagate (interceptor does not
    // swallow it; the exception filter handles the HTTP response).
    result$.subscribe({
      next: () => {
        throw new Error('should not emit a value');
      },
      error: (err) => {
        expect(err).toBe(failure);
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy.mock.calls[0][0]).toContain('FAILED');
        warnSpy.mockRestore();
        done();
      },
    });
  });

  it('should_not_log_the_request_body_or_sensitive_data', (done) => {
    // Arrange
    const interceptor = new LoggingInterceptor();
    const context = buildContext(request, response);
    const handler = new FakeCallHandler(of('ok'));
    const logSpy = jest
      .spyOn(interceptor['logger'], 'log')
      .mockImplementation(() => undefined);

    // Act
    const result$ = interceptor.intercept(context, handler);

    // Assert — no log line contains anything that looks like a
    // password field. The interceptor only sees method/url anyway,
    // but this guards against a future regression that adds body.
    result$.subscribe({
      complete: () => {
        const allLogged = logSpy.mock.calls.map((c) => String(c[0])).join(' ');
        expect(allLogged).not.toContain('password');
        logSpy.mockRestore();
        done();
      },
    });
  });
});