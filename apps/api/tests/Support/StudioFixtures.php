<?php

namespace Tests\Support;

use App\Models\User;
use App\Modules\Catalog\Models\Product;
use App\Modules\Catalog\Models\Variant;
use App\Modules\Commerce\Actions\SubmitOrderRequest;
use App\Modules\Commerce\Data\SubmitOrderData;
use App\Modules\Delivery\Models\Rule;
use App\Modules\Identity\Models\StaffMembership;
use App\Modules\Inventory\Models\Balance;
use App\Support\Actor;

trait StudioFixtures
{
    protected function configureCommerce(): void
    {
        config(['auraflare.checkout_enabled' => true, 'auraflare.tax_policy' => 'none', 'auraflare.manual_instructions' => 'Synthetic fixture only', 'auraflare.manual_payee_name' => 'Fixture payee', 'auraflare.manual_destination' => 'NOT-A-REAL-BANK', 'auraflare.razorpay.mode' => 'test', 'auraflare.razorpay.key_id' => 'rzp_test_fixture', 'auraflare.razorpay.key_secret' => 'test-fixture-secret', 'auraflare.razorpay.webhook_secret' => 'test-webhook-secret']);
        Rule::create(['kind' => 'state', 'state_code' => 'KL', 'allow' => true, 'active' => true, 'priority' => 0]);
    }

    protected function person(?string $role = null): User
    {
        $u = User::create(['name' => 'Synthetic Person', 'email' => bin2hex(random_bytes(8)).'@example.test', 'password' => 'Synthetic-Password-2026!', 'email_verified_at' => now()]);
        if ($role) {
            StaffMembership::create(['user_id' => $u->id, 'role' => $role, 'active' => true]);
        }

        return $u;
    }

    protected function variant(int $stock = 5, int $price = 34950): Variant
    {
        $p = Product::create(['title' => 'Synthetic candle fixture', 'slug' => 'fixture-'.bin2hex(random_bytes(5)), 'description' => 'Synthetic test fixture; not a real product.', 'scent_notes' => [], 'status' => 'active']);
        $v = Variant::create(['product_id' => $p->id, 'sku' => 'FIX-'.bin2hex(random_bytes(5)), 'options' => [], 'options_hash' => hash('sha256', '[]'), 'price_minor' => $price, 'active' => true]);
        Balance::create(['variant_id' => $v->id, 'on_hand' => $stock]);

        return $v;
    }

    protected function contact(): array
    {
        return ['name' => 'Synthetic Customer', 'email' => 'customer@example.test', 'phone' => '+919000000000'];
    }

    protected function address(): array
    {
        return ['line1' => 'Synthetic test address', 'city' => 'Kannur', 'state_code' => 'KL', 'postcode' => '670001', 'country_code' => 'IN'];
    }

    protected function order(Variant $v, ?Actor $a = null, int $quantity = 1)
    {
        return app(SubmitOrderRequest::class)->execute(new SubmitOrderData($this->contact(), $this->address(), [['variant_id' => $v->public_id, 'quantity' => $quantity]]), $a ?? new Actor(null, 'guest-fixture'));
    }
}
