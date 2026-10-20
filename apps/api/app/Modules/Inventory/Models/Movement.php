<?php

namespace App\Modules\Inventory\Models;

use App\Support\Record;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $public_id
 * @property int $variant_id
 * @property int|null $order_id
 * @property int|null $actor_id
 * @property int $on_hand_delta
 * @property int $reserved_delta
 * @property string $reason
 * @property string $effect_key
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Movement extends Record
{
    protected $table = 'inventory_movements';

    protected function casts(): array
    {
        return ['on_hand_delta' => 'integer', 'reserved_delta' => 'integer'];
    }
}
