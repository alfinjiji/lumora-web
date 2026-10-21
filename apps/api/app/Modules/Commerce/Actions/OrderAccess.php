<?php

namespace App\Modules\Commerce\Actions;

use App\Modules\Commerce\Models\Order;
use App\Support\Actor;
use App\Support\ApiError;
use Illuminate\Support\Facades\Gate;

final class OrderAccess
{
    public function execute(string $id, Actor $a): Order
    {
        $o = Order::where('public_id', $id)->firstOrFail();
        ApiError::ensure(Gate::forUser($a->user)->allows('view', [$o, $a]), 'NOT_FOUND', 'Order not found.', 404);

        return $o;
    }
}
