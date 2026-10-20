<?php

namespace App\Modules\Catalog\Models;

use App\Support\Record;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $public_id
 * @property int $product_id
 * @property string $sku
 * @property array $options
 * @property string $options_hash
 * @property int $price_minor
 * @property string $currency
 * @property bool $active
 * @property int $version
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Variant extends Record
{
    protected $table = 'product_variants';

    protected function casts(): array
    {
        return ['options' => 'array', 'active' => 'boolean', 'price_minor' => 'integer', 'version' => 'integer'];
    }
}
