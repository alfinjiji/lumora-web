<?php

namespace App\Modules\Payments\Jobs;

use App\Modules\Payments\Actions\ReconcilePayment;
use App\Modules\Payments\Actions\RequestRefund;
use App\Modules\Payments\Actions\SettleOrderPayment;
use App\Modules\Payments\Models\Attempt;
use App\Modules\Payments\Models\Refund;
use App\Modules\Payments\Models\WebhookEvent;
use App\Support\Actor;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

final class ProcessWebhook implements ShouldQueue
{
    use Queueable;

    public int $tries = 5;

    public function __construct(public int $eventId) {}

    public function handle(): void
    {
        $e = WebhookEvent::findOrFail($this->eventId);
        if ($e->processed_at) {
            return;
        }$payload = $e->payload;
        $facts = $payload['payload']['payment']['entity'] ?? null;
        if ($facts && ($facts['status'] ?? null) === 'captured') {
            $p = Attempt::where('provider_order_id', $facts['order_id'] ?? '')->first();
            if (! $p) {
                throw new \RuntimeException('Payment attempt is not linked yet; retry reconciliation.');
            }app(SettleOrderPayment::class)->execute($p, $facts, new Actor(null, 'webhook'));
        }
        if ($facts && in_array($facts['status'] ?? null, ['failed', 'authorized'], true)) {
            $p = Attempt::where('provider_order_id', $facts['order_id'] ?? '')->first();
            if (! $p) {
                throw new \RuntimeException('Payment attempt not linked yet.');
            }
            app(ReconcilePayment::class)->execute($p);
        }
        $refund = $payload['payload']['refund']['entity'] ?? null;
        if ($refund) {
            $reference = $refund['receipt'] ?? $refund['notes']['internal_ref'] ?? null;
            $r = Refund::where('public_id', $reference)->first();
            if ($r) {
                app(RequestRefund::class)->apply($r, $refund);
            }
        }
        $e->update(['processed_at' => now(), 'status' => 'processed', 'attempts' => $e->attempts + 1]);
    }
}
