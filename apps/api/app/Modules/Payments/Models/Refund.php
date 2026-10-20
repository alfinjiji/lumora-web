<?php

namespace App\Modules\Payments\Models;

use App\Support\Record;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $public_id
 * @property int $attempt_id
 * @property int $amount_minor
 * @property string $status
 * @property string|null $provider_ref
 * @property string|null $bank_reference
 * @property string $reason
 * @property int $version
 * @property string|null $refunded_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property int|null $receipt_id
 */
class Refund extends Record
{
    protected $table = 'refunds';

    protected function casts(): array
    {
        return ['amount_minor' => 'integer', 'version' => 'integer'];
    }
}
