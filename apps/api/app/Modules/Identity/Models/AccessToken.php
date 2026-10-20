<?php

namespace App\Modules\Identity\Models;

use App\Support\Record;
use Carbon\CarbonImmutable;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $public_id
 * @property string $purpose
 * @property string $email
 * @property string $token_hash
 * @property array|null $payload
 * @property CarbonImmutable $expires_at
 * @property CarbonImmutable|null $used_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class AccessToken extends Record
{
    protected $table = 'access_tokens';

    protected function casts(): array
    {
        return ['expires_at' => 'immutable_datetime', 'used_at' => 'immutable_datetime', 'payload' => 'array'];
    }
}
