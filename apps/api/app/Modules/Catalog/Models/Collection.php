<?php

namespace App\Modules\Catalog\Models;

use App\Support\Record;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $public_id
 * @property string $slug
 * @property string $title
 * @property string $status
 * @property int $version
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Collection extends Record
{
    protected $table = 'collections';

    protected function casts(): array
    {
        return ['version' => 'integer'];
    }
}
