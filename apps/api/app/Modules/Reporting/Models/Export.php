<?php

namespace App\Modules\Reporting\Models;

use App\Support\Record;
use Carbon\CarbonImmutable;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $public_id
 * @property int $requester_id
 * @property array $filters
 * @property string $status
 * @property string|null $key
 * @property CarbonImmutable|null $expires_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Export extends Record
{
    protected $table = 'export_jobs';

    protected function casts(): array
    {
        return ['filters' => 'array', 'expires_at' => 'immutable_datetime'];
    }
}
