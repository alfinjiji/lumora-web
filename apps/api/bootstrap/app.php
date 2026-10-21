<?php

use App\Http\Middleware\ApiContext;
use App\Support\ApiError;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(web: __DIR__.'/../routes/web.php', commands: __DIR__.'/../routes/console.php', health: '/up')
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->convertEmptyStringsToNull(except: [fn ($request) => $request->isJson()]);
        $middleware->web(append: [ApiContext::class]);
        $middleware->validateCsrfTokens(except: ['webhooks/razorpay']);
        $middleware->redirectGuestsTo(fn () => null);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(fn () => true);
        $exceptions->report(function (Throwable $e) {
            Log::error('Application operation failed', ['exception_type' => get_class($e), 'request_id' => request()?->header('X-Request-ID'), 'file' => basename($e->getFile()), 'line' => $e->getLine()]);

            return false;
        });
        $exceptions->render(function (Throwable $e, $request) {
            if ($e instanceof ValidationException) {
                $status = 422;
                $code = 'VALIDATION_ERROR';
                $message = 'Please check the highlighted fields.';
                $fields = $e->errors();
            } elseif ($e instanceof ApiError) {
                $status = $e->status;
                $code = $e->errorCode;
                $message = $e->getMessage();
                $fields = $e->fields;
            } elseif ($e instanceof AuthenticationException) {
                $status = 401;
                $code = 'UNAUTHENTICATED';
                $message = 'Sign in to continue.';
            } elseif ($e instanceof HttpExceptionInterface) {
                $status = $e->getStatusCode();
                $code = match ($status) {
                    403 => 'FORBIDDEN',404 => 'NOT_FOUND',419 => 'CSRF_EXPIRED',429 => 'RATE_LIMITED',default => 'HTTP_ERROR'
                };
                $message = match ($status) {
                    404 => 'The requested record was not found.',419 => 'Your session expired. Reload and try again.',429 => 'Too many requests. Try again shortly.',default => 'Request could not be completed.'
                };
            } elseif ($e instanceof ModelNotFoundException) {
                $status = 404;
                $code = 'NOT_FOUND';
                $message = 'The requested record was not found.';
            } elseif ($e instanceof QueryException && in_array($e->errorInfo[1] ?? null, [1062, 3819])) {
                $status = 409;
                $code = 'CONSTRAINT_CONFLICT';
                $message = 'This change conflicts with an existing record.';
            } else {
                $status = 500;
                $code = 'INTERNAL_ERROR';
                $message = 'The operation could not be completed. Please try again.';
            }

            return response()->json(['error' => ['code' => $code, 'message' => $message, 'fields' => (object) ($fields ?? [])], 'request_id' => $request->header('X-Request-ID', 'unavailable')], $status, $status === 429 ? ['Retry-After' => (string) ($e instanceof HttpExceptionInterface ? ($e->getHeaders()['Retry-After'] ?? 60) : 60)] : []);
        });
    })->create();
