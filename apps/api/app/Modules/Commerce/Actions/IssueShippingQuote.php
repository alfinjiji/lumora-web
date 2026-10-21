<?php

namespace App\Modules\Commerce\Actions;

use App\Modules\Commerce\Models\Order;
use App\Modules\Commerce\Models\Quote;
use App\Modules\Inventory\Actions\LockOrderStock;
use App\Modules\Payments\Models\Attempt;
use App\Support\Actor;
use App\Support\ApiError;
use App\Support\Audit;
use App\Support\Version;
use Illuminate\Support\Carbon;

final class IssueShippingQuote
{
    public function execute(Order $order, array $d, Actor $a): Order
    {
        $a->owner();

        return app(LockOrderStock::class)->execute($order->id, function ($o, $r) use ($d, $a) {
            $a->owner();
            Version::check($o, $d['expected_version']);
            ApiError::ensure($r->status === 'active' && $r->expires_at->isFuture() && in_array($o->status, ['awaiting_shipping_quote', 'awaiting_payment']), 'INVALID_TRANSITION', 'Only an active unpaid order can be quoted.');
            ApiError::ensure(! Attempt::where('order_id', $o->id)->whereIn('status', ['created', 'pending', 'unknown', 'authorized', 'under_review'])->lockForUpdate()->first(), 'PAYMENT_IN_PROGRESS', 'Resolve the current payment attempt first.');
            $expires = Carbon::parse($d['expires_at']);
            ApiError::ensure($expires->isFuture() && $expires->lte(now()->addHours(config('auraflare.payment_hours'))), 'VALIDATION_ERROR', 'Choose a deadline within the configured payment window.', 422);
            $version = (int) Quote::where('order_id', $o->id)->max('version') + 1;
            if ($version > 1) {
                ApiError::ensure($expires->lte($r->expires_at), 'INVALID_TRANSITION', 'Use an explicit reservation extension before extending a revised quote.');
            }Quote::where('order_id', $o->id)->whereIn('status', ['current', 'accepted'])->update(['status' => 'superseded']);
            $total = $o->subtotal_minor + $o->tax_minor + $d['shipping_minor'];
            $q = Quote::create(['order_id' => $o->id, 'version' => $version, 'amount_minor' => $d['shipping_minor'], 'total_minor' => $total, 'expires_at' => $expires, 'issued_by' => $a->user->id, 'note' => $d['note'] ?? null]);
            $o->update(['shipping_minor' => $d['shipping_minor'], 'total_minor' => $total, 'current_quote_id' => $q->id, 'status' => 'awaiting_payment', 'version' => $o->version + 1]);
            if ($version === 1) {
                $r->update(['expires_at' => $expires]);
            }Audit::write($a, 'quote.issued', 'order', $o->public_id);
            Audit::outbox('quote:'.$q->public_id, 'order', ['order_id' => $o->public_id, 'email' => $o->contact['email']]);

            return $o;
        });
    }
}
