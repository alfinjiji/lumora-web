<?php

namespace App\Modules\Commerce\Models;

use App\Support\Record;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $public_id
 * @property int $cart_id
 * @property int $variant_id
 * @property int $quantity
 * @property int $unit_price_minor
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class CartItem extends Record
{
    protected $table = 'cart_items';

    protected function casts(): array
    {
        return ['quantity' => 'integer', 'unit_price_minor' => 'integer'];
    }
}
