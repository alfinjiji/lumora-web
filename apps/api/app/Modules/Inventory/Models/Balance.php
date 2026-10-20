<?php

namespace App\Modules\Inventory\Models;

use App\Support\Record;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $public_id
 * @property int $variant_id
 * @property int $on_hand
 * @property int $reserved
 * @property int $low_stock_threshold
 * @property int $version
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Balance extends Record
{
    protected $attributes = ['on_hand' => 0, 'reserved' => 0, 'low_stock_threshold' => 10];

    protected $table = 'inventory_balances';

    protected function casts(): array
    {
        return ['on_hand' => 'integer', 'reserved' => 'integer', 'version' => 'integer', 'low_stock_threshold' => 'integer'];
    }
}
