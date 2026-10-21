<?php

namespace App\Modules\Commerce\Actions;

use App\Modules\Catalog\Models\Product;
use App\Modules\Catalog\Models\Variant;
use App\Modules\Commerce\Data\SubmitOrderData;
use App\Modules\Commerce\Models\GuestGrant;
use App\Modules\Commerce\Models\Order;
use App\Modules\Commerce\Models\OrderItem;
use App\Modules\Delivery\Actions\CheckDelivery;
use App\Modules\Inventory\Models\Balance;
use App\Modules\Inventory\Models\Movement;
use App\Modules\Inventory\Models\Reservation;
use App\Support\Actor;
use App\Support\ApiError;
use App\Support\Audit;
use App\Support\ProductionConfiguration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class SubmitOrderRequest
{
    public function execute(SubmitOrderData $data, Actor $a): Order
    {
        if ($data->source !== 'website') {
            $a->staff();
        }
        ApiError::ensure(! ProductionConfiguration::issues(), 'CHECKOUT_UNAVAILABLE', 'The studio is not accepting orders yet.', 503);
        ApiError::ensure((bool) config('auraflare.checkout_enabled'), 'CHECKOUT_UNAVAILABLE', 'Order requests are not open yet.', 503);
        ApiError::ensure(in_array(config('auraflare.tax_policy'), ['none', 'exclusive']), 'BUSINESS_CONFIGURATION_REQUIRED', 'Tax policy must be confirmed before order intake.', 503);
        ApiError::ensure(app(CheckDelivery::class)->execute($data->address), 'DELIVERY_UNAVAILABLE', 'This delivery area is not currently supported.');
        ApiError::ensure(count($data->items) > 0, 'VALIDATION_ERROR', 'Your bag is empty.', 422);

        return DB::transaction(function () use ($data, $a) {
            $variants = [];
            foreach ($data->items as $line) {
                $id = $line['variant_id'];
                $variants[$id] = ($variants[$id] ?? 0) + $line['quantity'];
            }
            $records = Variant::whereIn('public_id', array_keys($variants))->orderBy('id')->get();
            ApiError::ensure($records->count() === count($variants), 'INSUFFICIENT_STOCK', 'One or more variants are unavailable.');
            $balances = Balance::whereIn('variant_id', $records->pluck('id'))->orderBy('variant_id')->lockForUpdate()->get()->keyBy('variant_id');
            $subtotal = 0;
            foreach ($records as $v) {
                $qty = $variants[$v->public_id];
                ApiError::ensure($qty >= 1 && $qty <= 100 && $v->active && Product::findOrFail($v->product_id)->status === 'active' && $balances[$v->id]->on_hand - $balances[$v->id]->reserved >= $qty, 'INSUFFICIENT_STOCK', 'One or more items are no longer available.');
                $subtotal += $v->price_minor * $qty;
            }
            $contact = $data->contact;
            $contact['email'] = strtolower(trim($contact['email']));
            $outstanding = Order::where('contact->email', $contact['email'])->whereIn('status', ['awaiting_shipping_quote', 'awaiting_payment', 'payment_review'])->count();
            ApiError::ensure($outstanding < 5, 'TOO_MANY_REQUESTS', 'Please resolve your existing requests first.', 429);
            if ($data->source === 'website') {
                $activeStatuses = ['awaiting_shipping_quote', 'awaiting_payment', 'payment_review'];
                $personal = $a->user ? Order::where('user_id', $a->user->id)->whereIn('status', $activeStatuses)->count() : Order::whereIn('id', GuestGrant::where('session_hash', hash('sha256', $a->sessionId))->select('order_id'))->whereIn('status', $activeStatuses)->count();
                ApiError::ensure($personal < 5, 'TOO_MANY_REQUESTS', 'Resolve your existing order requests before creating another.', 429);
            }
            $tax = config('auraflare.tax_policy') === 'exclusive' ? intdiv($subtotal * (int) config('auraflare.tax_basis_points') + 5000, 10000) : 0;
            $o = Order::create(['number' => 'AF-'.now()->format('Y').'-'.strtoupper(Str::random(10)), 'user_id' => $data->source === 'website' ? $a->user?->id : null, 'source' => $data->source, 'contact' => $contact, 'address' => $data->address, 'customer_note' => $data->note, 'policy_snapshot' => ['tax_policy' => config('auraflare.tax_policy'), 'tax_basis_points' => config('auraflare.tax_basis_points'), 'serviceability_checked_at' => now()->toISOString()], 'status' => 'awaiting_shipping_quote', 'subtotal_minor' => $subtotal, 'tax_minor' => $tax]);
            $r = Reservation::create(['order_id' => $o->id, 'status' => 'active', 'expires_at' => now()->addHours(config('auraflare.review_hours'))]);
            foreach ($records as $v) {
                $qty = $variants[$v->public_id];
                $p = Product::findOrFail($v->product_id);
                OrderItem::create(['order_id' => $o->id, 'variant_id' => $v->id, 'sku' => $v->sku, 'title' => $p->title, 'options' => $v->options, 'quantity' => $qty, 'unit_price_minor' => $v->price_minor, 'line_total_minor' => $v->price_minor * $qty]);
                DB::table('reservation_items')->insert(['reservation_id' => $r->id, 'variant_id' => $v->id, 'quantity' => $qty]);
                $b = $balances[$v->id];
                $b->update(['reserved' => $b->reserved + $qty, 'version' => $b->version + 1]);
                Movement::create(['variant_id' => $v->id, 'order_id' => $o->id, 'actor_id' => $a->user?->id, 'on_hand_delta' => 0, 'reserved_delta' => $qty, 'reason' => 'Order request reserved', 'effect_key' => $r->public_id.':reserve:'.$v->id]);
            }
            if (! $a->user) {
                GuestGrant::create(['session_hash' => hash('sha256', $a->sessionId), 'order_id' => $o->id, 'expires_at' => now()->addDays(30)]);
            }
            Audit::write($a, 'order.requested', 'order', $o->public_id);
            Audit::outbox('order:'.$o->public_id.':requested', 'order', ['order_id' => $o->public_id, 'email' => $contact['email']]);

            return $o;
        }, 3);
    }
}
