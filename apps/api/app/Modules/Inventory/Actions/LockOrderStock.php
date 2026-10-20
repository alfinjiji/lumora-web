<?php

namespace App\Modules\Inventory\Actions;

use App\Modules\Commerce\Models\Order;
use App\Modules\Commerce\Models\OrderItem;
use App\Modules\Inventory\Models\Balance;
use App\Modules\Inventory\Models\Movement;
use App\Modules\Inventory\Models\Reservation;
use App\Support\Actor;
use App\Support\ApiError;

final class LockOrderStock
{
    // Every stock/order command locks sorted balance IDs, then order, then reservation, then quote/attempt.
    public function execute(int $id, callable $work): mixed
    {
        return \DB::transaction(function () use ($id, $work) {
            $ids = OrderItem::where('order_id', $id)->orderBy('variant_id')->pluck('variant_id');
            $balances = Balance::whereIn('variant_id', $ids)->orderBy('variant_id')->lockForUpdate()->get()->keyBy('variant_id');
            $order = Order::whereKey($id)->lockForUpdate()->firstOrFail();
            $reservation = Reservation::where('order_id', $id)->lockForUpdate()->firstOrFail();

            return $work($order, $reservation, $balances);
        }, 3);
    }

    public function effect(Order $o, Reservation $r, $balances, string $effect, Actor $a): void
    {
        ApiError::ensure($r->status === 'active', 'INVALID_RESERVATION', 'Stock reservation is no longer active.');
        foreach (\DB::table('reservation_items')->where('reservation_id', $r->id)->orderBy('variant_id')->get() as $item) {
            $b = $balances[$item->variant_id];
            $delta = $effect === 'consume' ? -$item->quantity : 0;
            $b->update(['on_hand' => $b->on_hand + $delta, 'reserved' => $b->reserved - $item->quantity, 'version' => $b->version + 1]);
            Movement::create(['variant_id' => $item->variant_id, 'order_id' => $o->id, 'actor_id' => $a->user?->id, 'on_hand_delta' => $delta, 'reserved_delta' => -$item->quantity, 'reason' => $effect === 'consume' ? 'Verified payment settled' : 'Reservation released', 'effect_key' => $r->public_id.':'.$effect.':'.$item->variant_id]);
        }
        $r->update(['status' => $effect === 'consume' ? 'consumed' : 'released']);
    }
}
