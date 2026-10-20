<?php

namespace App\Http\Middleware;

use App\Support\Actor;
use App\Support\ApiError;
use Closure;

final class Capability
{
    public function handle($request, Closure $next, string $cap)
    {
        $actor = Actor::request();
        if ($cap === 'owner') {
            $actor->owner();
        } elseif ($cap === 'staff') {
            $actor->staff();
        } elseif (in_array($cap, ['authenticated', 'customer', 'verified-customer'])) {
            ApiError::ensure((bool) $actor->user, 'UNAUTHENTICATED', 'Sign in to continue.', 401);
            if ($cap === 'verified-customer') {
                ApiError::ensure((bool) $actor->user->email_verified_at, 'EMAIL_NOT_VERIFIED', 'Verify your email first.', 403);
            }
        }

        return $next($request);
    }
}
