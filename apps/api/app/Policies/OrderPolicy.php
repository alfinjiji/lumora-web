<?php

namespace App\Policies;

use App\Models\User;
use App\Modules\Commerce\Models\GuestGrant;
use App\Modules\Commerce\Models\Order;
use App\Support\Actor;

/** Customer ownership and an order-scoped guest capability are distinct access paths. */
final class OrderPolicy
{
    public function view(?User $user, Order $order, Actor $actor): bool
    {
        if ($user && $order->user_id === $user->id) {
            return true;
        }

        return GuestGrant::where('order_id', $order->id)->where('session_hash', hash('sha256', $actor->sessionId))->whereNull('revoked_at')->where('expires_at', '>', now())->exists();
    }
}
