<?php

namespace App\Modules\Commerce\Models;

use App\Support\Record;
use Carbon\CarbonImmutable;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $public_id
 * @property string $session_hash
 * @property int $order_id
 * @property CarbonImmutable $expires_at
 * @property string|null $revoked_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class GuestGrant extends Record
{
    protected $table = 'guest_grants';

    protected function casts(): array
    {
        return ['expires_at' => 'immutable_datetime'];
    }
}
