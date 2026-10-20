<?php

namespace App\Modules\Enquiries\Models;

use App\Support\Record;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $public_id
 * @property array $contact
 * @property string $source
 * @property string $message
 * @property int|null $product_id
 * @property Carbon|null $event_date
 * @property int|null $quantity
 * @property string $status
 * @property int|null $assigned_to
 * @property int $version
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Enquiry extends Record
{
    protected $attributes = ['status' => 'new'];

    protected $table = 'enquiries';

    protected function casts(): array
    {
        return ['contact' => 'array', 'event_date' => 'date:Y-m-d', 'quantity' => 'integer', 'version' => 'integer'];
    }
}
