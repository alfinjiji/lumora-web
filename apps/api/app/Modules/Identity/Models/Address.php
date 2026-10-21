<?php

namespace App\Modules\Identity\Models;

use App\Support\Record;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $public_id
 * @property int $user_id
 * @property string $line1
 * @property string $line2
 * @property string $city
 * @property string $state_code
 * @property string $postcode
 * @property string $country_code
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Address extends Record
{
    protected $table = 'customer_addresses';

    protected function casts(): array
    {
        return [];
    }
}
