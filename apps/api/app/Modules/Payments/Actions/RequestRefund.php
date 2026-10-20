<?php

namespace App\Modules\Payments\Actions;

use App\Modules\Commerce\Models\Order;
use App\Modules\Payments\Contracts\RazorpayGateway;
use App\Modules\Payments\Models\Attempt;
use App\Modules\Payments\Models\Refund;
use App\Support\Actor;
use App\Support\ApiError;
use App\Support\Audit;
use App\Support\Version;
use Illuminate\Support\Facades\DB;

final class RequestRefund
{
    public function create(Order $order, array $d, Actor $a): Refund
    {
        $a->owner();

        return DB::transaction(function () use ($order, $d, $a) {
            $o = Order::whereKey($order->id)->lockForUpdate()->firstOrFail();
            $a->owner();
            Version::check($o, $d['expected_version']);
            $p = Attempt::where('public_id', $d['payment_attempt_id'])->where('order_id', $o->id)->lockForUpdate()->firstOrFail();
            $receipts = DB::table('payment_receipts')->where('attempt_id', $p->id);
            if (! empty($d['payment_receipt_id'])) {
                $receipts->where('public_id', $d['payment_receipt_id']);
            }$receipt = $receipts->orderBy('id')->first();
            ApiError::ensure((bool) $receipt, 'INVALID_TRANSITION', 'No verified received payment is available for refund.');
            ApiError::ensure(! Refund::where('receipt_id', $receipt->id)->exists(), 'INVALID_TRANSITION', 'This receipt already has a refund operation.');
            $r = Refund::create(['attempt_id' => $p->id, 'receipt_id' => $receipt->id, 'amount_minor' => $receipt->amount_minor, 'status' => 'requested', 'reason' => $d['reason']]);
            $o->update(['payment_status' => 'refund_pending', 'version' => $o->version + 1]);
            Audit::write($a, 'refund.requested', 'refund', $r->public_id);

            return $r;
        }, 3);
    }

    public function send(Refund $r): Refund
    {
        $p = Attempt::findOrFail($r->attempt_id);
        if ($p->method !== 'razorpay') {
            return $r;
        }
        if (! Refund::whereKey($r->id)->where('status', 'requested')->update(['status' => 'processing'])) {
            return $r->refresh();
        }
        $receipt = DB::table('payment_receipts')->where('id', $r->receipt_id)->first();
        $paymentId = substr($receipt->external_id, strlen('razorpay:'));
        try {
            $result = app(RazorpayGateway::class)->refund($paymentId, $r->amount_minor, $r->public_id);
            $this->apply($r, $result);
        } catch (\Throwable) {/* Ambiguous outcome remains processing for reconciliation, never blind resubmission. */
        }

        return $r->refresh();
    }

    public function apply(Refund $r, array $facts): void
    {
        DB::transaction(function () use ($r, $facts) {
            $p = Attempt::findOrFail($r->attempt_id);
            $o = Order::whereKey($p->order_id)->lockForUpdate()->firstOrFail();
            $r = Refund::whereKey($r->id)->lockForUpdate()->firstOrFail();
            if ($r->status === 'succeeded') {
                return;
            }$receipt = DB::table('payment_receipts')->where('id', $r->receipt_id)->first();
            ApiError::ensure(($facts['amount'] ?? null) === $r->amount_minor && ($facts['payment_id'] ?? null) === substr($receipt->external_id, strlen('razorpay:')) && (($facts['receipt'] ?? null) === $r->public_id || ($facts['notes']['internal_ref'] ?? null) === $r->public_id), 'PAYMENT_MISMATCH', 'Refund response mismatch.', 422);
            $state = match ($facts['status'] ?? null) {
                'processed' => 'succeeded','failed' => 'failed',default => 'processing'
            };
            $r->update(['provider_ref' => $facts['id'], 'status' => $state, 'version' => $r->version + 1, 'refunded_at' => $state === 'succeeded' ? now() : null]);
            if (in_array($state, ['succeeded', 'failed'])) {
                $o->update(['payment_status' => self::paymentState($o), 'version' => $o->version + 1]);
                Audit::write(new Actor(null, 'refund-reconciliation'), 'refund.'.$state, 'refund', $r->public_id);
            }
        });
    }

    public static function paymentState(Order $o): string
    {
        $ids = Attempt::where('order_id', $o->id)->pluck('id');
        if (Refund::whereIn('attempt_id', $ids)->whereIn('status', ['requested', 'processing'])->exists()) {
            return 'refund_pending';
        }
        $net = (int) DB::table('payment_receipts')->whereIn('attempt_id', $ids)->sum('amount_minor') - (int) Refund::whereIn('attempt_id', $ids)->where('status', 'succeeded')->sum('amount_minor');

        return $net === 0 ? 'refunded' : ($net === $o->total_minor && $o->paid_at ? 'paid' : 'exception');
    }

    public function reconcile(Refund $r): void
    {
        $p = Attempt::findOrFail($r->attempt_id);
        if ($p->method !== 'razorpay') {
            return;
        }$receipt = DB::table('payment_receipts')->where('id', $r->receipt_id)->first();
        foreach (app(RazorpayGateway::class)->refundsForPayment(substr($receipt->external_id, strlen('razorpay:'))) as $f) {
            if (($f['receipt'] ?? null) === $r->public_id || ($f['notes']['internal_ref'] ?? null) === $r->public_id) {
                $this->apply($r, $f);
            }
        }
    }
}
