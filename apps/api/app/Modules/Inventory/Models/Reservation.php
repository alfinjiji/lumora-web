<?php

namespace App\Modules\Inventory\Models;

use App\Support\Record;
use Carbon\CarbonImmutable;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $public_id
 * @property int $order_id
 * @property string $status
 * @property CarbonImmutable $expires_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Reservation extends Record
{
    protected $table = 'stock_reservations';

    protected function casts(): array
    {
        return ['expires_at' => 'immutable_datetime'];
    }
}
