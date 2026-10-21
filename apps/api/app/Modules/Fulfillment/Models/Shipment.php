<?php

namespace App\Modules\Fulfillment\Models;

use App\Support\Record;
use Carbon\CarbonImmutable;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $public_id
 * @property int $order_id
 * @property string $carrier
 * @property string $tracking_number
 * @property string|null $tracking_url
 * @property CarbonImmutable $shipped_at
 * @property CarbonImmutable|null $delivered_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Shipment extends Record
{
    protected $table = 'shipments';

    protected function casts(): array
    {
        return ['shipped_at' => 'immutable_datetime', 'delivered_at' => 'immutable_datetime'];
    }
}
