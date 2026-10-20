<?php

namespace App\Modules\Payments\Actions;

use App\Modules\Commerce\Models\Quote;
use App\Modules\Inventory\Actions\LockOrderStock;
use App\Modules\Payments\Models\Attempt;
use App\Support\Actor;
use App\Support\ApiError;
use App\Support\Audit;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class SettleOrderPayment
{
    public function execute(Attempt $attempt, array $facts, Actor $a, ?CarbonInterface $receivedAt = null): Attempt
    {
        ApiError::ensure(($facts['status'] ?? null) === 'captured' && ($facts['order_id'] ?? null) === $attempt->provider_order_id && ($facts['amount'] ?? null) === $attempt->amount_minor && ($facts['currency'] ?? null) === 'INR', 'PAYMENT_MISMATCH', 'Payment verification did not match this order.', 422);

        return app(LockOrderStock::class)->execute($attempt->order_id, function ($o, $r, $balances) use ($attempt, $facts, $a, $receivedAt) {
            $p = Attempt::whereKey($attempt->id)->lockForUpdate()->firstOrFail();
            $external = ($p->method === 'manual' ? 'manual:' : 'razorpay:').$facts['id'];
            $existing = DB::table('payment_receipts')->where('external_id', $external)->lockForUpdate()->first();
            if ($existing) {
                ApiError::ensure($existing->attempt_id === $p->id, 'PAYMENT_MISMATCH', 'This receipt belongs to another payment.', 422);

                return $p;
            }
            $q = Quote::findOrFail($p->quote_id);
            $valid = ! $p->settled_at && ! $o->paid_at && $r->status === 'active' && $r->expires_at->isFuture() && ($q->expires_at->isFuture() || ($p->method === 'manual' && $p->status === 'under_review')) && $o->current_quote_id === $q->id && $q->status === 'accepted' && in_array($o->status, ['awaiting_payment', 'payment_review']);
            DB::table('payment_receipts')->insert(['public_id' => (string) Str::ulid(), 'attempt_id' => $p->id, 'external_id' => $external, 'amount_minor' => $p->amount_minor, 'disposition' => $valid ? 'settled' : 'exception', 'received_at' => $receivedAt ?? now(), 'created_at' => now(), 'updated_at' => now()]);
            if (! $valid) {
                if ($r->status === 'active' && $r->expires_at->isPast()) {
                    app(LockOrderStock::class)->effect($o, $r, $balances, 'release', $a);
                    $o->status = 'expired';
                }$o->payment_status = 'exception';
                $o->version++;
                $o->save();
                if (! $p->settled_at) {
                    $p->update(['status' => 'exception', 'provider_payment_id' => $facts['id'], 'provider_facts' => array_intersect_key($facts, array_flip(['id', 'order_id', 'amount', 'currency', 'status']))]);
                }Audit::write($a, 'payment.exception', 'order', $o->public_id);

                return $p;
            }
            app(LockOrderStock::class)->effect($o, $r, $balances, 'consume', $a);
            $p->update(['status' => $p->method === 'manual' ? 'verified' : 'captured', 'provider_payment_id' => $facts['id'], 'provider_facts' => array_intersect_key($facts, array_flip(['id', 'order_id', 'amount', 'currency', 'status'])), 'settled_at' => now()]);
            $o->update(['status' => 'confirmed', 'payment_status' => 'paid', 'paid_at' => now(), 'version' => $o->version + 1]);
            Audit::write($a, 'payment.settled', 'order', $o->public_id);
            Audit::outbox('settled:'.$o->public_id, 'order', ['order_id' => $o->public_id, 'email' => $o->contact['email']]);

            return $p;
        });
    }
}
