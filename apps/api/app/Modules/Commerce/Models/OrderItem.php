<?php

namespace App\Modules\Commerce\Models;

use App\Support\Record;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $public_id
 * @property int $order_id
 * @property int $variant_id
 * @property string $sku
 * @property string $title
 * @property array $options
 * @property int $quantity
 * @property int $unit_price_minor
 * @property int $line_total_minor
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class OrderItem extends Record
{
    protected $table = 'order_items';

    protected function casts(): array
    {
        return ['options' => 'array', 'quantity' => 'integer', 'unit_price_minor' => 'integer', 'line_total_minor' => 'integer'];
    }
}
