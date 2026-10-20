<?php

namespace App\Modules\Fulfillment\Http;

use App\Modules\Commerce\Models\Order;
use App\Modules\Commerce\Queries\OrderQuery;
use App\Modules\Fulfillment\Actions\TransitionFulfillment;
use App\Modules\Fulfillment\Models\Shipment;
use App\Support\Actor;
use App\Support\ContractRequest;
use App\Support\Http\ApiController;

final class FulfillmentController extends ApiController
{
    public function transition(ContractRequest $r, string $orderId, OrderQuery $q)
    {
        $command = basename($r->path());

        return $this->command($r, function () use ($r, $orderId, $q, $command) {
            $o = app(TransitionFulfillment::class)->execute(Order::where('public_id', $orderId)->firstOrFail(), $command, $r->validated(), Actor::request());

            return $command === 'shipment' ? OrderQuery::shipment(Shipment::where('order_id', $o->id)->firstOrFail(), $o) : $q->project($o, Actor::request(), true);
        }, $command === 'shipment' ? 201 : 200);
    }
}
