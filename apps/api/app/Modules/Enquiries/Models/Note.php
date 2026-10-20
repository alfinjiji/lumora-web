<?php

namespace App\Modules\Enquiries\Models;

use App\Support\Record;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $public_id
 * @property int $enquiry_id
 * @property int $actor_id
 * @property string $body
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Note extends Record
{
    protected $table = 'enquiry_notes';

    protected function casts(): array
    {
        return [];
    }
}
