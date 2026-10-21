<?php

namespace App\Modules\Commerce\Actions;

use App\Models\User;
use App\Modules\Catalog\Models\Product;
use App\Modules\Catalog\Models\Variant;
use App\Modules\Commerce\Models\Cart;
use App\Modules\Commerce\Models\CartItem;
use App\Modules\Inventory\Models\Balance;
use App\Support\Actor;
use App\Support\ApiError;
use App\Support\Version;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ManageCart
{
    public function cart(Actor $a): Cart
    {
        $key = $a->user ? 'user:'.$a->user->id : 'guest:'.hash('sha256', $a->sessionId);
        DB::table('carts')->insertOrIgnore(['public_id' => (string) Str::ulid(), 'owner_key' => $key, 'user_id' => $a->user?->id, 'session_hash' => hash('sha256', $a->sessionId), 'version' => 1, 'created_at' => now(), 'updated_at' => now()]);

        return Cart::where('owner_key', $key)->firstOrFail();
    }

    public function reviewPrices(Cart $cart): Cart
    {
        return DB::transaction(function () use ($cart) {
            $cart = Cart::whereKey($cart->id)->lockForUpdate()->firstOrFail();
            $changed = false;
            foreach (CartItem::where('cart_id', $cart->id)->get() as $item) {
                $price = Variant::findOrFail($item->variant_id)->price_minor;
                if ($item->unit_price_minor !== $price) {
                    $item->update(['unit_price_minor' => $price]);
                    $changed = true;
                }
            }if ($changed) {
                $cart->update(['version' => $cart->version + 1]);
            }

            return $cart;
        }, 3);
    }

    public function project(Cart $cart): array
    {
        $items = CartItem::where('cart_id', $cart->id)->orderBy('id')->get()->map(function ($i) {
            $v = Variant::findOrFail($i->variant_id);
            $b = Balance::where('variant_id', $v->id)->firstOrFail();

            return ['id' => $i->public_id, 'variant_id' => $v->public_id, 'quantity' => $i->quantity, 'unit_price_minor' => $v->price_minor, 'line_total_minor' => $v->price_minor * $i->quantity, 'available_quantity' => $v->active && Product::findOrFail($v->product_id)->status === 'active' ? $b->on_hand - $b->reserved : 0];
        })->all();

        return ['id' => $cart->public_id, 'version' => $cart->version, 'currency' => 'INR', 'items' => $items, 'subtotal_minor' => array_sum(array_column($items, 'line_total_minor'))];
    }

    public function mutate(Actor $actor, array $d, string $method, ?string $id = null): array
    {
        return DB::transaction(function () use ($actor, $d, $method, $id) {
            $cart = $this->cart($actor);
            $cart = Cart::whereKey($cart->id)->lockForUpdate()->firstOrFail();
            Version::check($cart, $d['expected_version']);
            if ($id) {
                $item = CartItem::where('cart_id', $cart->id)->where('public_id', $id)->firstOrFail();
            } else {
                $v = Variant::where('public_id', $d['variant_id'])->where('active', true)->firstOrFail();
                ApiError::ensure(Product::findOrFail($v->product_id)->status === 'active', 'NOT_FOUND', 'Product unavailable.', 404);
                $item = CartItem::firstOrNew(['cart_id' => $cart->id, 'variant_id' => $v->id]);
            }
            if ($method === 'DELETE') {
                $item->delete();
            } else {
                $quantity = $d['quantity'] + ($method === 'POST' ? ($item->quantity ?? 0) : 0);
                ApiError::ensure($quantity <= 100, 'VALIDATION_ERROR', 'Maximum 100 per variant.', 422);
                $v = Variant::findOrFail($item->variant_id);
                $item->fill(['quantity' => $quantity, 'unit_price_minor' => $v->price_minor])->save();
            }
            $cart->update(['version' => $cart->version + 1]);

            return $this->project($cart);
        }, 3);
    }

    public function merge(string $oldSession, string $newSession, User $user): void
    {
        DB::transaction(function () use ($oldSession, $newSession, $user) {
            $target = $this->cart(new Actor($user, $newSession));
            $target = Cart::whereKey($target->id)->lockForUpdate()->firstOrFail();
            $old = Cart::where('owner_key', 'guest:'.hash('sha256', $oldSession))->lockForUpdate()->first();
            if ($old) {
                foreach (CartItem::where('cart_id', $old->id)->get() as $item) {
                    $v = Variant::find($item->variant_id);
                    if (! $v || ! $v->active) {
                        continue;
                    }$next = CartItem::firstOrNew(['cart_id' => $target->id, 'variant_id' => $v->id]);
                    $next->fill(['quantity' => min(100, ($next->quantity ?? 0) + $item->quantity), 'unit_price_minor' => $v->price_minor])->save();
                }$old->update(['owner_key' => null, 'submitted_at' => now()]);
                $target->update(['version' => $target->version + 1]);
            }
            DB::table('guest_grants')->where('session_hash', hash('sha256', $oldSession))->update(['session_hash' => hash('sha256', $newSession)]);
        }, 3);
    }
}
