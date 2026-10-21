<?php

namespace App\Modules\Identity\Models;

use App\Support\Record;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $public_id
 * @property int $user_id
 * @property string $role
 * @property bool $active
 * @property int $version
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class StaffMembership extends Record
{
    protected $table = 'staff_memberships';

    protected function casts(): array
    {
        return ['active' => 'boolean', 'version' => 'integer'];
    }
}
