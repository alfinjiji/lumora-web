<?php

namespace App\Modules\Content\Models;

use App\Support\Record;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $public_id
 * @property int $version
 * @property string $status
 * @property array $hero
 * @property string $announcement
 * @property int|null $featured_collection_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Revision extends Record
{
    protected $table = 'content_revisions';

    protected function casts(): array
    {
        return ['hero' => 'array', 'version' => 'integer'];
    }
}
