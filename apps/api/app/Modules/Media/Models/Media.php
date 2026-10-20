<?php

namespace App\Modules\Media\Models;

use App\Support\Record;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $public_id
 * @property int|null $owner_id
 * @property int|null $order_id
 * @property string|null $guest_session_hash
 * @property string $purpose
 * @property string $disk
 * @property string $key
 * @property string $mime
 * @property int $bytes
 * @property string $status
 * @property string|null $scan_status
 * @property string|null $attached_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Media extends Record
{
    protected $table = 'media';

    protected function casts(): array
    {
        return [];
    }
}
