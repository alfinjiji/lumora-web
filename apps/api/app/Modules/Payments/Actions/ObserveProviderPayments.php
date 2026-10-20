<?php

namespace App\Modules\Payments\Actions;

use App\Modules\Inventory\Actions\LockOrderStock;
use App\Modules\Payments\Models\Attempt;
use App\Support\Actor;
use App\Support\ApiError;
use App\Support\Audit;

/** Apply a complete provider order payment listing; stale failures cannot undo settlement. */
final class ObserveProviderPayments
{
    public function execute(Attempt $attempt, array $payments): Attempt
    {
        foreach ($payments as $facts) {
            ApiError::ensure(($facts['order_id'] ?? null) === $attempt->provider_order_id && ($facts['amount'] ?? null) === $attempt->amount_minor && ($facts['currency'] ?? null) === 'INR', 'PAYMENT_MISMATCH', 'Provider payment facts did not match.', 422);
            if (($facts['status'] ?? null) === 'captured') {
                app(SettleOrderPayment::class)->execute($attempt, $facts, new Actor(null, 'reconciliation'));
            }
        }

        return app(LockOrderStock::class)->execute($attempt->order_id, function ($o) use ($attempt, $payments) {
            $p = Attempt::whereKey($attempt->id)->lockForUpdate()->firstOrFail();
            if ($p->settled_at || in_array($p->status, ['captured', 'verified', 'exception']) || ! $payments) {
                return $p;
            }
            $statuses = array_column($payments, 'status');
            $state = in_array('authorized', $statuses, true) ? 'authorized' : (count(array_filter($statuses, fn ($s) => $s === 'failed')) === count($payments) ? 'failed' : 'pending');
            if ($p->status === $state) {
                return $p;
            }
            $p->update(['status' => $state]);
            if ($state === 'failed' && in_array($o->status, ['awaiting_payment', 'payment_review']) && ! Attempt::where('order_id', $o->id)->whereKeyNot($p->id)->whereIn('status', ['created', 'unknown', 'pending', 'authorized', 'under_review'])->lockForUpdate()->first()) {
                $o->update(['payment_status' => 'unpaid', 'version' => $o->version + 1]);
            }
            Audit::write(new Actor(null, 'reconciliation'), 'payment.'.$state, 'payment_attempt', $p->public_id);

            return $p;
        });
    }
}
