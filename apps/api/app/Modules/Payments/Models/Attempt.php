<?php

namespace App\Modules\Payments\Models;

use App\Support\Record;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $public_id
 * @property int $order_id
 * @property int $quote_id
 * @property string $method
 * @property string $status
 * @property int $amount_minor
 * @property string $currency
 * @property string|null $provider_order_id
 * @property string|null $provider_payment_id
 * @property string $receipt
 * @property array|null $provider_facts
 * @property string|null $failure_code
 * @property string|null $settled_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Attempt extends Record
{
    protected $table = 'payment_attempts';

    protected function casts(): array
    {
        return ['amount_minor' => 'integer', 'provider_facts' => 'array'];
    }
}
