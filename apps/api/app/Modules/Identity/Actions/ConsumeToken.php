<?php

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Models\AccessToken;
use App\Support\ApiError;

final class ConsumeToken
{
    public function execute(string $purpose, string $raw, callable $effect): mixed
    {
        return \DB::transaction(function () use ($purpose, $raw, $effect) {
            $token = AccessToken::where('token_hash', hash('sha256', $raw))->where('purpose', $purpose)->lockForUpdate()->first();
            ApiError::ensure($token && ! $token->used_at && $token->expires_at->isFuture(), 'INVALID_TOKEN', 'This link is invalid or expired.', 422);
            $result = $effect($token);
            $token->update(['used_at' => now()]);

            return $result;
        }, 3);
    }
}
