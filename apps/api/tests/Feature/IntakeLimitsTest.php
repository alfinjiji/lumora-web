<?php

namespace Tests\Feature;

use App\Modules\Commerce\Actions\SubmitOrderRequest;
use App\Modules\Commerce\Data\SubmitOrderData;
use App\Support\Actor;
use App\Support\ApiError;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\StudioFixtures;
use Tests\TestCase;

final class IntakeLimitsTest extends TestCase
{
    use RefreshDatabase,StudioFixtures;

    public function test_order_intake_has_a_separate_rate_limit_before_any_stock_reservation(): void
    {
        for ($i = 0; $i < 6; $i++) {
            $this->postJson('/api/v1/order-requests', [])->assertStatus(422);
        }
        $this->postJson('/api/v1/order-requests', [])->assertStatus(429)->assertHeader('Retry-After');
        $this->assertDatabaseCount('orders', 0);
    }

    public function test_one_guest_cannot_bypass_outstanding_hold_limit_by_changing_email(): void
    {
        $this->configureCommerce();
        $v = $this->variant(10);
        $a = new Actor(null, 'limited-guest');
        for ($i = 0; $i < 5; $i++) {
            app(SubmitOrderRequest::class)->execute(new SubmitOrderData(array_replace($this->contact(), ['email' => 'synthetic-'.$i.'@example.test']), $this->address(), [['variant_id' => $v->public_id, 'quantity' => 1]]), $a);
        }
        try {
            app(SubmitOrderRequest::class)->execute(new SubmitOrderData(array_replace($this->contact(), ['email' => 'different@example.test']), $this->address(), [['variant_id' => $v->public_id, 'quantity' => 1]]), $a);
            $this->fail('Guest exceeded the outstanding hold limit.');
        } catch (ApiError $e) {
            $this->assertSame('TOO_MANY_REQUESTS', $e->errorCode);
        }
        $this->assertDatabaseCount('orders', 5);
    }

    public function test_unsafe_production_configuration_keeps_order_intake_closed(): void
    {
        $this->configureCommerce();
        app()->detectEnvironment(fn () => 'production');
        config(['app.url' => 'http://unconfigured.example.test', 'session.secure' => false, 'auraflare.business_config_approved' => false]);
        try {
            $this->order($this->variant());
            $this->fail('Unqualified production configuration opened intake.');
        } catch (ApiError $e) {
            $this->assertSame('CHECKOUT_UNAVAILABLE', $e->errorCode);
        }
        $this->assertDatabaseCount('orders', 0);
    }
}
