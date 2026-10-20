<?php

namespace App\Modules\Commerce\Actions;

use App\Modules\Commerce\Models\Order;
use App\Modules\Inventory\Actions\LockOrderStock;
use App\Modules\Payments\Models\Attempt;
use App\Support\Actor;
use App\Support\ApiError;
use App\Support\Audit;
use App\Support\Version;

final class CancelOrder
{
    public function execute(Order $order, array $d, Actor $a, bool $admin = false): Order
    {
        if ($admin) {
            $a->owner();
        } else {
            app(OrderAccess::class)->execute($order->public_id, $a);
        }

        return app(LockOrderStock::class)->execute($order->id, function ($o, $r, $balances) use ($d, $a, $admin) {
            Version::check($o, $d['expected_version']);
            ApiError::ensure(! Attempt::where('order_id', $o->id)->whereIn('status', ['created', 'pending', 'unknown', 'authorized', 'under_review'])->lockForUpdate()->first(), 'PAYMENT_IN_PROGRESS', 'Reconcile the unresolved payment before cancellation.');
            ApiError::ensure(! in_array($o->fulfillment_status, ['shipped', 'delivered']) && ! in_array($o->status, ['cancelled', 'expired']), 'INVALID_TRANSITION', 'This order cannot be cancelled.');
            ApiError::ensure($admin || ! in_array($o->payment_status, ['paid', 'refund_pending', 'refunded', 'exception']), 'INVALID_TRANSITION', 'Contact the studio for a paid order cancellation.');
            if ($r->status === 'active') {
                app(LockOrderStock::class)->effect($o, $r, $balances, 'release', $a);
            }$o->update(['status' => 'cancelled', 'fulfillment_status' => 'cancelled', 'version' => $o->version + 1]);
            Audit::write($a, 'order.cancelled', 'order', $o->public_id);

            return $o;
        });
    }
}
