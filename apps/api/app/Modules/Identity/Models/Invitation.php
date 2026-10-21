<?php

namespace App\Modules\Identity\Models;

use App\Support\Record;
use Carbon\CarbonImmutable;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $public_id
 * @property string $email
 * @property string $name
 * @property string $role
 * @property string $token_hash
 * @property CarbonImmutable $expires_at
 * @property CarbonImmutable|null $accepted_at
 * @property string|null $revoked_at
 * @property int|null $invited_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Invitation extends Record
{
    protected $table = 'invitations';

    protected function casts(): array
    {
        return ['expires_at' => 'immutable_datetime', 'accepted_at' => 'immutable_datetime'];
    }
}
