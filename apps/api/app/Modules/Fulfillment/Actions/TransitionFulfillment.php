<?php

namespace App\Modules\Fulfillment\Actions;

use App\Modules\Commerce\Models\Order;
use App\Modules\Fulfillment\Models\Shipment;
use App\Support\Actor;
use App\Support\ApiError;
use App\Support\Audit;
use App\Support\Version;
use Illuminate\Support\Facades\DB;

final class TransitionFulfillment
{
    public function execute(Order $order, string $command, array $d, Actor $a): Order
    {
        $a->staff();

        return DB::transaction(function () use ($order, $command, $d, $a) {
            $o = Order::whereKey($order->id)->lockForUpdate()->firstOrFail();
            Version::check($o, $d['expected_version']);
            ApiError::ensure($o->payment_status === 'paid' && $o->status === 'confirmed', 'INVALID_TRANSITION', 'Only a confirmed, paid order may be fulfilled.');
            $expected = match ($command) {
                'packing' => 'unfulfilled','shipment' => 'packing','delivered' => 'shipped'
            };
            ApiError::ensure($o->fulfillment_status === $expected, 'INVALID_TRANSITION', 'This fulfillment step is not available.');
            if ($command === 'shipment') {
                Shipment::create(['order_id' => $o->id, 'carrier' => $d['carrier'], 'tracking_number' => $d['tracking_number'], 'tracking_url' => $d['tracking_url'] ?? null, 'shipped_at' => now()]);
            }
            if ($command === 'delivered') {
                Shipment::where('order_id', $o->id)->firstOrFail()->update(['delivered_at' => now()]);
            }$o->update(['fulfillment_status' => match ($command) {
                'packing' => 'packing','shipment' => 'shipped','delivered' => 'delivered'
            }, 'status' => $command === 'delivered' ? 'completed' : 'confirmed', 'version' => $o->version + 1]);
            Audit::write($a, 'fulfillment.'.$command, 'order', $o->public_id);
            Audit::outbox('fulfillment:'.$o->public_id.':'.$command, 'order', ['order_id' => $o->public_id, 'email' => $o->contact['email']]);

            return $o;
        }, 3);
    }
}
