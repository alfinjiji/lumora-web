<?php

namespace App\Modules\Payments\Models;

use App\Support\Record;
use Carbon\CarbonImmutable;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $public_id
 * @property string $provider
 * @property string $event_id
 * @property string $payload_hash
 * @property array $payload
 * @property string $status
 * @property int $attempts
 * @property CarbonImmutable|null $processed_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class WebhookEvent extends Record
{
    protected $table = 'webhook_events';

    protected function casts(): array
    {
        return ['payload' => 'array', 'processed_at' => 'immutable_datetime'];
    }
}
