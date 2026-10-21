<?php

namespace App\Modules\Catalog\Models;

use App\Support\Record;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $public_id
 * @property string $slug
 * @property string $title
 * @property string $description
 * @property array $scent_notes
 * @property string $status
 * @property int $version
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Product extends Record
{
    protected $table = 'products';

    protected function casts(): array
    {
        return ['scent_notes' => 'array', 'version' => 'integer'];
    }
}
