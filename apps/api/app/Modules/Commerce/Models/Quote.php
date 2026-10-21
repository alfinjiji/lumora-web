<?php

namespace App\Modules\Commerce\Models;

use App\Support\Record;
use Carbon\CarbonImmutable;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $public_id
 * @property int $order_id
 * @property int $version
 * @property int $amount_minor
 * @property int $total_minor
 * @property string $status
 * @property CarbonImmutable $expires_at
 * @property CarbonImmutable|null $accepted_at
 * @property int $issued_by
 * @property string|null $note
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Quote extends Record
{
    protected $table = 'shipping_quotes';

    protected function casts(): array
    {
        return ['version' => 'integer', 'amount_minor' => 'integer', 'total_minor' => 'integer', 'expires_at' => 'immutable_datetime', 'accepted_at' => 'immutable_datetime'];
    }
}
