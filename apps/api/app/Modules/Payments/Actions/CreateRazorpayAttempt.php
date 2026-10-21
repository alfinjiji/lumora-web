<?php

namespace App\Modules\Payments\Actions;

use App\Modules\Commerce\Models\Order;
use App\Modules\Inventory\Actions\LockOrderStock;
use App\Modules\Payments\Contracts\RazorpayGateway;
use App\Modules\Payments\Models\Attempt;
use App\Support\Actor;
use App\Support\ApiError;
use App\Support\Audit;
use App\Support\Idempotency;

final class CreateRazorpayAttempt
{
    public function execute(Order $order, array $d, Actor $a, string $key): Attempt
    {
        ApiError::ensure(config('auraflare.razorpay.mode') !== 'disabled', 'PAYMENTS_UNAVAILABLE', 'Online payment is not configured.', 503);
        $scope = ($a->user?->public_id ?? $a->sessionId).'|payment|'.$order->public_id;
        $result = app(Idempotency::class)->execute($scope, $key, $d, fn () => app(LockOrderStock::class)->execute($order->id, function ($o, $r) use ($d) {
            $q = app(AcceptQuote::class)->execute($o, $r, $d);
            ApiError::ensure(! Attempt::where('order_id', $o->id)->whereIn('status', ['created', 'pending', 'unknown', 'authorized', 'under_review'])->lockForUpdate()->first(), 'PAYMENT_IN_PROGRESS', 'A payment is already being verified.');
            $p = Attempt::create(['order_id' => $o->id, 'quote_id' => $q->id, 'method' => 'razorpay', 'status' => 'created', 'amount_minor' => $q->total_minor, 'receipt' => 'AF'.bin2hex(random_bytes(14))]);
            $o->update(['payment_status' => 'pending', 'version' => $o->version + 1]);

            return ['attempt_id' => $p->id];
        }));
        $p = Attempt::findOrFail($result['attempt_id']);
        // Claim before any provider call: a crash/timeout is unknown and is reconciled, never blindly retried.
        $claimed = Attempt::whereKey($p->id)->where('status', 'created')->update(['status' => 'unknown']);
        if (! $claimed) {
            return $p->refresh();
        }
        try {
            $provider = app(RazorpayGateway::class)->createOrder($p->amount_minor, $p->receipt);
            ApiError::ensure(($provider['amount'] ?? null) === $p->amount_minor && ($provider['currency'] ?? null) === 'INR' && ($provider['receipt'] ?? null) === $p->receipt, 'PAYMENT_MISMATCH', 'Provider order mismatch.', 503);
            $p->update(['provider_order_id' => $provider['id'], 'status' => 'pending']);
        } catch (\Throwable $e) {
            $p->refresh();
            Audit::write($a, 'payment.creation_unknown', 'payment_attempt', $p->public_id);
        }

        return $p->refresh();
    }
}
