<?php

namespace App\Modules\Payments\Models;

use App\Support\Record;
use Carbon\CarbonImmutable;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $public_id
 * @property int $attempt_id
 * @property string $reference
 * @property int|null $media_id
 * @property string $status
 * @property string|null $bank_reference
 * @property CarbonImmutable $submitted_at
 * @property int|null $reviewed_by
 * @property CarbonImmutable|null $reviewed_at
 * @property string|null $review_reason
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Evidence extends Record
{
    protected $table = 'manual_payment_evidence';

    protected function casts(): array
    {
        return ['submitted_at' => 'immutable_datetime', 'reviewed_at' => 'immutable_datetime'];
    }
}
