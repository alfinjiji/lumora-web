<?php

namespace App\Modules\Commerce\Http;

use App\Modules\Catalog\Models\Variant;
use App\Modules\Commerce\Actions\CancelOrder;
use App\Modules\Commerce\Actions\ExpireReservations;
use App\Modules\Commerce\Actions\IssueShippingQuote;
use App\Modules\Commerce\Actions\ManageCart;
use App\Modules\Commerce\Actions\OrderAccess;
use App\Modules\Commerce\Actions\SubmitOrderRequest;
use App\Modules\Commerce\Data\SubmitOrderData;
use App\Modules\Commerce\Models\Cart;
use App\Modules\Commerce\Models\CartItem;
use App\Modules\Commerce\Models\GuestGrant;
use App\Modules\Commerce\Models\Order;
use App\Modules\Commerce\Queries\OrderQuery;
use App\Modules\Identity\Actions\ConsumeToken;
use App\Modules\Identity\Actions\IssueToken;
use App\Modules\Inventory\Actions\LockOrderStock;
use App\Support\Actor;
use App\Support\ApiError;
use App\Support\Audit;
use App\Support\ContractRequest;
use App\Support\Http\ApiController;
use App\Support\Version;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class CommerceController extends ApiController
{
    public function cart(ManageCart $c)
    {
        app(ExpireReservations::class)->execute();

        return $this->ok($c->project($c->reviewPrices($c->cart(Actor::request()))));
    }

    public function cartMutate(ContractRequest $r, ManageCart $c, ?string $itemId = null)
    {
        return $this->ok($c->mutate(Actor::request(), $r->validated(), $r->method(), $itemId));
    }

    public function submit(ContractRequest $r, ManageCart $c, OrderQuery $q)
    {
        app(ExpireReservations::class)->execute();

        return $this->command($r, function () use ($r, $c, $q) {
            $d = $r->validated();
            $a = Actor::request();
            $cart = $c->cart($a);
            $cart = Cart::whereKey($cart->id)->lockForUpdate()->firstOrFail();
            ApiError::ensure($cart->public_id === $d['cart_id'], 'NOT_FOUND', 'Bag not found.', 404);
            Version::check($cart, $d['expected_cart_version']);
            $items = CartItem::where('cart_id', $cart->id)->get();
            foreach ($items as $i) {
                ApiError::ensure($i->unit_price_minor === Variant::findOrFail($i->variant_id)->price_minor, 'PRICE_CHANGED', 'A product price changed. Review your bag before submitting.');
            }$data = new SubmitOrderData($d['contact'], $d['address'], $items->map(fn ($i) => ['variant_id' => Variant::findOrFail($i->variant_id)->public_id, 'quantity' => $i->quantity])->all(), 'website', $d['customer_note'] ?? '');
            $order = app(SubmitOrderRequest::class)->execute($data, $a);
            $cart->update(['submitted_at' => now(), 'owner_key' => null, 'version' => $cart->version + 1]);

            return $q->project($order, $a);
        }, 201);
    }

    public function orders(OrderQuery $q)
    {
        $admin = str_contains(request()->path(), '/admin/');
        $list = Order::query();
        if (! $admin) {
            $list->where('user_id', auth()->id());
        }if ($status = request('status')) {
            $list->where('status', $status);
        }if ($search = request('q')) {
            $list->where('number', 'like', '%'.mb_substr($search, 0, 100).'%');
        }

        return $this->listing($list->orderByDesc('id'), fn ($o) => $q->project($o, Actor::request(), $admin));
    }

    public function show(string $orderId, OrderQuery $q)
    {
        $admin = str_contains(request()->path(), '/admin/');
        $o = $admin ? Order::where('public_id', $orderId)->firstOrFail() : app(OrderAccess::class)->execute($orderId, Actor::request());

        return $this->ok($q->project($o, Actor::request(), $admin));
    }

    public function direct(ContractRequest $r, OrderQuery $q)
    {
        app(ExpireReservations::class)->execute();

        return $this->command($r, function () use ($r, $q) {
            $d = $r->validated();
            $a = Actor::request();
            $o = app(SubmitOrderRequest::class)->execute(new SubmitOrderData($d['contact'], $d['address'], $d['items'], $d['source'], $d['customer_note'] ?? ''), $a);

            return $q->project($o, $a, true);
        }, 201);
    }

    public function quote(ContractRequest $r, string $orderId, OrderQuery $q)
    {
        return $this->command($r, fn () => $q->project(app(IssueShippingQuote::class)->execute(Order::where('public_id', $orderId)->firstOrFail(), $r->validated(), Actor::request()), Actor::request(), true));
    }

    public function cancel(ContractRequest $r, string $orderId, OrderQuery $q)
    {
        $admin = str_contains($r->path(), '/admin/');
        $o = $admin ? Order::where('public_id', $orderId)->firstOrFail() : app(OrderAccess::class)->execute($orderId, Actor::request());

        return $this->command($r, fn () => $q->project(app(CancelOrder::class)->execute($o, $r->validated(), Actor::request(), $admin), Actor::request(), $admin));
    }

    public function extend(ContractRequest $r, string $orderId, OrderQuery $q)
    {
        return $this->command($r, function () use ($r, $orderId, $q) {
            $order = Order::where('public_id', $orderId)->firstOrFail();
            $d = $r->validated();
            $o = app(LockOrderStock::class)->execute($order->id, function ($o, $hold) use ($d) {
                Version::check($o, $d['expected_version']);
                ApiError::ensure($hold->status === 'active' && $hold->expires_at->isFuture(), 'INVALID_TRANSITION', 'An expired hold cannot be extended.');
                $expires = Carbon::parse($d['expires_at']);
                ApiError::ensure($expires->gt($hold->expires_at) && $expires->lte(now()->addDays(7)), 'VALIDATION_ERROR', 'Choose a later deadline within seven days.', 422);
                $hold->update(['expires_at' => $expires]);
                $o->update(['version' => $o->version + 1]);
                Audit::write(Actor::request(), 'reservation.extended', 'order', $o->public_id);

                return $o;
            });

            return $q->project($o, Actor::request(), true);
        });
    }

    public function accessRequest(ContractRequest $r)
    {
        $d = $r->validated();
        $o = Order::where('number', $d['number'])->where('contact->email', $d['email'])->first();
        if ($o) {
            app(IssueToken::class)->execute('guest-order', $d['email'], ['order_id' => $o->id], 30);
        }

        return $this->ack(202);
    }

    public function exchange(ContractRequest $r)
    {
        $id = app(ConsumeToken::class)->execute('guest-order', $r->validated()['token'], function ($t) {
            $o = Order::findOrFail($t->payload['order_id']);
            GuestGrant::updateOrCreate(['order_id' => $o->id, 'session_hash' => hash('sha256', session()->getId())], ['expires_at' => now()->addDays(30), 'revoked_at' => null]);

            return $o->public_id;
        });

        return $this->ok(['message' => 'Order access restored.', 'order_id' => $id]);
    }

    public function claim(string $orderId, OrderQuery $q)
    {
        $a = Actor::request();
        $o = app(OrderAccess::class)->execute($orderId, $a);
        $o = DB::transaction(function () use ($o, $a) {
            $o = Order::whereKey($o->id)->lockForUpdate()->firstOrFail();
            ApiError::ensure($a->user->email_verified_at && strtolower($o->contact['email']) === strtolower($a->user->email) && (! $o->user_id || $o->user_id === $a->user->id), 'FORBIDDEN', 'Verify the order email before claiming it.', 403);
            $o->update(['user_id' => $a->user->id, 'version' => $o->version + 1]);
            Audit::write($a, 'order.claimed', 'order', $o->public_id);

            return $o;
        });

        return $this->ok($q->project($o, $a));
    }
}
