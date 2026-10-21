<?php

namespace App\Modules\Delivery\Models;

use App\Support\Record;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $public_id
 * @property string $kind
 * @property string $state_code
 * @property string|null $city
 * @property string|null $postcode
 * @property bool $allow
 * @property bool $active
 * @property int $priority
 * @property int $version
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Rule extends Record
{
    protected $table = 'delivery_rules';

    protected function casts(): array
    {
        return ['allow' => 'boolean', 'active' => 'boolean', 'priority' => 'integer', 'version' => 'integer'];
    }
}
