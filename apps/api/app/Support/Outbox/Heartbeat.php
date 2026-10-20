<?php

namespace App\Support\Outbox;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Cache;

final class Heartbeat implements ShouldQueue
{
    use Queueable;

    public function handle(): void
    {
        Cache::store('redis')->put('health:worker', now()->timestamp, 300);
    }
}
