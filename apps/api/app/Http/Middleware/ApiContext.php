<?php

namespace App\Http\Middleware;

use App\Support\ApiError;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

final class ApiContext
{
    public function handle(Request $request, Closure $next)
    {
        $request->route()?->forgetParameter('input');
        $request->headers->set('Accept', 'application/json');
        $request->headers->set('X-Request-ID', (string) Str::uuid());
        if ($request->user() && ! $request->user()->active) {
            auth()->logout();
            $request->session()->invalidate();
            throw new ApiError('UNAUTHENTICATED', 'Sign in again.', 401);
        }
        $response = $next($request);
        $response->headers->set('X-Request-ID', $request->header('X-Request-ID'));
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('Cache-Control', 'private, no-store');

        return $response;
    }
}
