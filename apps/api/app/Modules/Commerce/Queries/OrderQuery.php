<?php

namespace App\Modules\Commerce\Queries;

use App\Modules\Catalog\Models\Variant;
use App\Modules\Commerce\Enums\FulfillmentStatus;
use App\Modules\Commerce\Enums\OrderStatus;
use App\Modules\Commerce\Enums\PaymentStatus;
use App\Modules\Commerce\Models\Order;
use App\Modules\Commerce\Models\OrderItem;
use App\Modules\Commerce\Models\Quote;
use App\Modules\Fulfillment\Models\Shipment;
use App\Modules\Inventory\Models\Reservation;
use App\Modules\Payments\Models\Attempt;
use App\Modules\Payments\Models\Evidence;
use App\Modules\Payments\Queries\PaymentQuery;
use App\Support\Actor;

final class OrderQuery
{
    public function project(Order $o, Actor $a, bool $admin = false): array
    {
        $r = Reservation::where('order_id', $o->id)->firstOrFail();
        $q = $o->current_quote_id ? Quote::find($o->current_quote_id) : null;
        $quote = $q ? ['id' => $q->public_id, 'version' => $q->version, 'shipping_minor' => $q->amount_minor, 'tax_minor' => $o->tax_minor, 'total_minor' => $q->total_minor, 'expires_at' => $q->expires_at->toISOString(), 'status' => $q->status, 'accepted_at' => $q->accepted_at?->toISOString()] : null;
        $active = $r->status === 'active' && $r->expires_at->isFuture();
        $unresolved = Attempt::where('order_id', $o->id)->whereIn('status', ['created', 'pending', 'unknown', 'authorized', 'under_review'])->exists();
        $actions = [];
        if ($active && $o->status === 'awaiting_payment' && ! $unresolved && $q && $q->expires_at->isFuture()) {
            $actions = ['pay', 'manual_payment'];
        }
        if ($active && ! $unresolved && ! in_array($o->payment_status, ['paid', 'exception'])) {
            $actions[] = 'cancel';
        }
        if (! $admin && $a->user && $a->user->email_verified_at && ! $o->user_id && strtolower($o->contact['email']) === strtolower($a->user->email)) {
            $actions[] = 'claim';
        }
        if ($admin) {
            if ($a->role() === 'owner' && $active && ! $unresolved && in_array($o->status, ['awaiting_shipping_quote', 'awaiting_payment'])) {
                $actions[] = 'quote';
            }if ($o->payment_status === 'paid' && $o->status === 'confirmed') {
                $actions = array_merge($actions, match ($o->fulfillment_status) {
                    'unfulfilled' => ['packing'],'packing' => ['shipment'],'shipped' => ['delivered'],default => []
                });
            }
        }
        $data = ['id' => $o->public_id, 'number' => $o->number, 'status' => OrderStatus::from($o->status)->value, 'payment_status' => PaymentStatus::from($o->payment_status)->value, 'fulfillment_status' => FulfillmentStatus::from($o->fulfillment_status)->value, 'currency' => 'INR', 'subtotal_minor' => $o->subtotal_minor, 'tax_minor' => $o->tax_minor, 'shipping_minor' => $o->shipping_minor, 'total_minor' => $o->total_minor, 'version' => $o->version, 'current_quote' => $quote, 'allowed_actions' => $actions, 'reservation_expires_at' => $r->expires_at->toISOString(), 'created_at' => $o->created_at->toISOString(), 'items' => OrderItem::where('order_id', $o->id)->get()->map(fn ($i) => ['variant_id' => Variant::findOrFail($i->variant_id)->public_id] + $i->only(['title', 'sku', 'quantity', 'unit_price_minor', 'line_total_minor']))->all()];
        $shipment = Shipment::where('order_id', $o->id)->first();
        if (! $admin) {
            $data['shipment'] = $shipment ? self::shipment($shipment, $o) : null;
        }
        if ($admin) {
            $owner = $a->role() === 'owner';
            $s = Shipment::where('order_id', $o->id)->first();
            $data += ['contact' => $o->contact, 'address' => $o->address, 'source' => $o->source, 'payment_attempts' => $owner ? Attempt::where('order_id', $o->id)->get()->map(fn ($p) => PaymentQuery::attempt($p))->all() : [], 'manual_evidence' => $owner ? Evidence::whereIn('attempt_id', Attempt::where('order_id', $o->id)->select('id'))->get()->map(fn ($e) => PaymentQuery::evidence($e))->all() : [], 'shipment' => $s ? self::shipment($s, $o) : null];
        }
        if ($admin && $a->role() === 'owner') {
            $data['payment_receipts'] = \DB::table('payment_receipts')->join('payment_attempts', 'payment_attempts.id', '=', 'payment_receipts.attempt_id')->where('payment_attempts.order_id', $o->id)->get(['payment_receipts.public_id as id', 'payment_attempts.public_id as attempt_id', 'payment_receipts.amount_minor', 'payment_receipts.disposition'])->map(fn ($x) => (array) $x)->all();
        }

        return $data;
    }

    public static function shipment(Shipment $s, Order $o): array
    {
        return ['id' => $s->public_id, 'order_id' => $o->public_id, 'carrier' => $s->carrier, 'tracking_number' => $s->tracking_number, 'tracking_url' => $s->tracking_url, 'shipped_at' => $s->shipped_at->toISOString(), 'delivered_at' => $s->delivered_at?->toISOString()];
    }
}
