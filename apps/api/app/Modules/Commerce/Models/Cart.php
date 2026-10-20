<?php

namespace App\Modules\Commerce\Models;

use App\Support\Record;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $public_id
 * @property int|null $user_id
 * @property string|null $session_hash
 * @property int $version
 * @property string|null $submitted_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property string|null $owner_key
 */
class Cart extends Record
{
    protected $table = 'carts';

    protected function casts(): array
    {
        return ['version' => 'integer'];
    }
}
