<?php

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Models\AccessToken;
use App\Support\Audit;
use Illuminate\Support\Facades\Crypt;

final class IssueToken
{
    public function execute(string $purpose, string $email, array $payload = [], int $minutes = 60): void
    {
        $token = bin2hex(random_bytes(32));
        $record = AccessToken::create(['purpose' => $purpose, 'email' => strtolower($email), 'token_hash' => hash('sha256', $token), 'payload' => $payload, 'expires_at' => now()->addMinutes($minutes)]);
        Audit::outbox('token:'.$record->public_id, 'identity', ['email' => $email, 'purpose' => $purpose, 'token' => Crypt::encryptString($token)]);
    }
}
