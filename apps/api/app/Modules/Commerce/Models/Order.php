<?php

namespace App\Modules\Commerce\Models;

use App\Support\Record;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $public_id
 * @property string $number
 * @property int|null $user_id
 * @property string $source
 * @property array $contact
 * @property array $address
 * @property string|null $customer_note
 * @property array $policy_snapshot
 * @property string $status
 * @property string $payment_status
 * @property string $fulfillment_status
 * @property string $currency
 * @property int $subtotal_minor
 * @property int $tax_minor
 * @property int|null $shipping_minor
 * @property int|null $total_minor
 * @property int $version
 * @property int|null $current_quote_id
 * @property string|null $paid_at
 * @property int $restocked
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Order extends Record
{
    protected $attributes = ['payment_status' => 'unpaid', 'fulfillment_status' => 'unfulfilled', 'currency' => 'INR', 'restocked' => false];

    protected $table = 'orders';

    protected function casts(): array
    {
        return ['contact' => 'array', 'address' => 'array', 'policy_snapshot' => 'array', 'subtotal_minor' => 'integer', 'tax_minor' => 'integer', 'shipping_minor' => 'integer', 'total_minor' => 'integer', 'version' => 'integer'];
    }
}
