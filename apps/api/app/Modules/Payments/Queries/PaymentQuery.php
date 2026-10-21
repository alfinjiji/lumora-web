<?php

namespace App\Modules\Payments\Queries;

use App\Modules\Commerce\Models\Order;
use App\Modules\Media\Models\Media;
use App\Modules\Payments\Models\Attempt;
use App\Modules\Payments\Models\Evidence;
use App\Modules\Payments\Models\Refund;

final class PaymentQuery
{
    public static function attempt(Attempt $p): array
    {
        return ['id' => $p->public_id, 'method' => $p->method, 'status' => $p->status, 'amount_minor' => $p->amount_minor, 'currency' => 'INR', 'provider_order_id' => $p->provider_order_id, 'public_key_id' => $p->method === 'razorpay' ? config('auraflare.razorpay.key_id') : null];
    }

    public static function evidence(Evidence $e): array
    {
        $p = Attempt::findOrFail($e->attempt_id);

        return ['id' => $e->public_id, 'order_id' => Order::findOrFail($p->order_id)->public_id, 'attempt_id' => $p->public_id, 'reference' => $e->reference, 'status' => $e->status, 'media_id' => $e->media_id ? Media::findOrFail($e->media_id)->public_id : null, 'submitted_at' => $e->submitted_at->toISOString(), 'review_reason' => $e->review_reason];
    }

    public static function refund(Refund $r): array
    {
        return ['id' => $r->public_id, 'order_id' => Order::findOrFail(Attempt::findOrFail($r->attempt_id)->order_id)->public_id, 'amount_minor' => $r->amount_minor, 'status' => $r->status, 'version' => $r->version];
    }
}
