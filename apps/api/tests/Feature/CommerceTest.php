<?php

namespace Tests\Feature;

use App\Modules\Commerce\Actions\CancelOrder;
use App\Modules\Commerce\Actions\ExpireReservations;
use App\Modules\Commerce\Actions\IssueShippingQuote;
use App\Modules\Commerce\Actions\OrderAccess;
use App\Modules\Commerce\Actions\SubmitOrderRequest;
use App\Modules\Commerce\Data\SubmitOrderData;
use App\Modules\Commerce\Models\Quote;
use App\Modules\Delivery\Actions\CheckDelivery;
use App\Modules\Delivery\Models\Rule;
use App\Modules\Fulfillment\Actions\TransitionFulfillment;
use App\Modules\Inventory\Actions\AdjustInventory;
use App\Modules\Inventory\Models\Balance;
use App\Modules\Inventory\Models\Movement;
use App\Modules\Payments\Actions\CreateRazorpayAttempt;
use App\Modules\Payments\Actions\ReconcilePayment;
use App\Modules\Payments\Actions\ReviewManualPayment;
use App\Modules\Payments\Actions\SettleOrderPayment;
use App\Modules\Payments\Actions\SubmitManualEvidence;
use App\Modules\Payments\Actions\VerifyCheckoutPayment;
use App\Modules\Payments\Contracts\RazorpayGateway;
use App\Support\Actor;
use App\Support\ApiError;
use App\Support\Idempotency;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\FakeGateway;
use Tests\Support\StudioFixtures;
use Tests\TestCase;

final class CommerceTest extends TestCase
{
    use RefreshDatabase,StudioFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->configureCommerce();
        $this->app->instance(RazorpayGateway::class, new FakeGateway);
    }

    private function quoted(int $stock = 5): array
    {
        $v = $this->variant($stock);
        $o = $this->order($v);
        $owner = $this->person('owner');
        $o = app(IssueShippingQuote::class)->execute($o, ['expected_version' => 1, 'shipping_minor' => 5000, 'expires_at' => now()->addHours(20)->toISOString()], new Actor($owner, 'owner'));
        $q = Quote::find($o->current_quote_id);

        return [$v, $o, $owner, ['quote_id' => $q->public_id, 'quote_version' => 1, 'accept_quote' => true]];
    }

    public function test_kerala_allowlist_and_postcode_deny_precedence(): void
    {
        $a = $this->address();
        $this->assertTrue(app(CheckDelivery::class)->execute($a));
        $this->assertFalse(app(CheckDelivery::class)->execute(array_replace($a, ['postcode' => '110001'])));
        $this->assertFalse(app(CheckDelivery::class)->execute(array_replace($a, ['postcode' => '641001'])));
        Rule::create(['kind' => 'postcode', 'state_code' => 'KL', 'postcode' => '670001', 'allow' => false, 'active' => true, 'priority' => 0]);
        $this->assertFalse(app(CheckDelivery::class)->execute($a));
        $this->assertFalse(app(CheckDelivery::class)->execute(array_replace($a, ['country_code' => 'US'])));
    }

    public function test_requests_reserve_stock_and_shipping_is_null_until_quoted(): void
    {
        $v = $this->variant(2);
        $o = $this->order($v);
        $this->assertNull($o->total_minor);
        $this->assertNull($o->shipping_minor);
        $this->assertSame('awaiting_shipping_quote', $o->status);
        $b = Balance::where('variant_id', $v->id)->first();
        $this->assertSame(2, $b->on_hand);
        $this->assertSame(1, $b->reserved);
        $this->assertDatabaseCount('orders', 1);
    }

    public function test_order_submission_rolls_back_every_line_when_one_is_unavailable(): void
    {
        $a = $this->variant(3);
        $b = $this->variant(0);
        try {
            app(SubmitOrderRequest::class)->execute(new SubmitOrderData($this->contact(), $this->address(), [['variant_id' => $a->public_id, 'quantity' => 2], ['variant_id' => $b->public_id, 'quantity' => 1]]), new Actor(null, 'guest'));
            $this->fail('Oversold');
        } catch (ApiError $e) {
            $this->assertSame('INSUFFICIENT_STOCK', $e->errorCode);
        }$this->assertDatabaseCount('orders', 0);
        $this->assertSame(0, Balance::where('variant_id', $a->id)->first()->reserved);
    }

    public function test_duplicate_lines_are_aggregated_before_reserving(): void
    {
        $v = $this->variant(2);
        $this->expectException(ApiError::class);
        app(SubmitOrderRequest::class)->execute(new SubmitOrderData($this->contact(), $this->address(), [['variant_id' => $v->public_id, 'quantity' => 2], ['variant_id' => $v->public_id, 'quantity' => 1]]), new Actor(null, 'guest'));
    }

    public function test_missing_configuration_fails_closed(): void
    {
        config(['auraflare.checkout_enabled' => false]);
        $this->expectException(ApiError::class);
        $this->order($this->variant());
    }

    public function test_idempotency_reuses_result_and_rejects_changed_payload(): void
    {
        $id = app(Idempotency::class);
        $n = 0;
        $f = function () use (&$n) {
            return ['id' => ++$n];
        };
        $this->assertSame($id->execute('scope', 'synthetic-key-00001', ['x' => 1], $f), $id->execute('scope', 'synthetic-key-00001', ['x' => 1], $f));
        $this->assertSame(1, $n);
        $this->expectException(ApiError::class);
        $id->execute('scope', 'synthetic-key-00001', ['x' => 2], $f);
    }

    public function test_guest_order_id_alone_grants_no_access(): void
    {
        $o = $this->order($this->variant());
        $this->expectException(ApiError::class);
        app(OrderAccess::class)->execute($o->public_id, new Actor(null, 'different-guest'));
    }

    public function test_adjustment_cannot_reduce_physical_stock_below_holds(): void
    {
        $v = $this->variant(2);
        $this->order($v);
        $u = $this->person('fulfillment');
        $b = Balance::where('variant_id', $v->id)->first();
        $this->expectException(ApiError::class);
        app(AdjustInventory::class)->execute($v->public_id, ['expected_version' => $b->version, 'on_hand_delta' => -2, 'reason' => 'Synthetic adjustment'], new Actor($u, 'staff'));
    }

    public function test_cancel_and_expiry_release_once_without_restocking_sold_units(): void
    {
        $v = $this->variant(2);
        $o = $this->order($v);
        app(CancelOrder::class)->execute($o, ['expected_version' => 1, 'reason' => 'Fixture cancel'], new Actor(null, 'guest-fixture'));
        $this->travel(3)->days();
        app(ExpireReservations::class)->execute();
        $b = Balance::where('variant_id', $v->id)->first();
        $this->assertSame(0, $b->reserved);
        $this->assertSame(2, $b->on_hand);
        $this->assertSame(1, Movement::where('order_id', $o->id)->where('reserved_delta', -1)->count());
    }

    public function test_timeout_after_provider_success_reconciles_without_a_second_create(): void
    {
        [$v,$o,$owner,$d] = $this->quoted();
        $g = app(RazorpayGateway::class);
        $g->timeoutAfterCreate = true;
        $p = app(CreateRazorpayAttempt::class)->execute($o, $d, new Actor(null, 'guest-fixture'), 'payment-fixture-key-001');
        $this->assertSame('unknown', $p->status);
        $same = app(CreateRazorpayAttempt::class)->execute($o, $d, new Actor(null, 'guest-fixture'), 'payment-fixture-key-001');
        $this->assertSame($p->id, $same->id);
        $this->assertSame(1, $g->creates);
        $p = app(ReconcilePayment::class)->execute($p);
        $this->assertNotNull($p->provider_order_id);
    }

    public function test_verified_capture_consumes_once_and_old_delivery_cannot_regress_payment(): void
    {
        [$v,$o,$owner,$d] = $this->quoted();
        $a = new Actor(null, 'guest-fixture');
        $p = app(CreateRazorpayAttempt::class)->execute($o, $d, $a, 'payment-fixture-key-001');
        $facts = ['id' => 'pay_fixture_1', 'order_id' => $p->provider_order_id, 'amount' => $p->amount_minor, 'currency' => 'INR', 'status' => 'captured'];
        app(SettleOrderPayment::class)->execute($p, $facts, $a);
        app(SettleOrderPayment::class)->execute($p, $facts, $a);
        $this->assertSame('paid', $o->refresh()->payment_status);
        $b = Balance::where('variant_id', $v->id)->first();
        $this->assertSame(4, $b->on_hand);
        $this->assertSame(0, $b->reserved);
        $this->assertDatabaseCount('payment_receipts', 1);
    }

    public function test_signature_amount_currency_and_order_mismatch_never_settle(): void
    {
        [$v,$o,$owner,$d] = $this->quoted();
        $a = new Actor(null, 'guest-fixture');
        $p = app(CreateRazorpayAttempt::class)->execute($o, $d, $a, 'payment-fixture-key-001');
        foreach ([['amount' => 1], ['currency' => 'USD'], ['order_id' => 'wrong']] as $override) {
            try {
                app(SettleOrderPayment::class)->execute($p, array_replace(['id' => 'bad', 'order_id' => $p->provider_order_id, 'amount' => $p->amount_minor, 'currency' => 'INR', 'status' => 'captured'], $override), $a);
                $this->fail('Wrong payment settled');
            } catch (ApiError) {
            }
        }$this->assertSame('pending', $o->refresh()->payment_status);
        $this->expectException(ApiError::class);
        app(VerifyCheckoutPayment::class)->execute($p, ['razorpay_order_id' => $p->provider_order_id, 'razorpay_payment_id' => 'pay_wrong', 'razorpay_signature' => 'forged'], $a);
    }

    public function test_late_capture_is_an_exception_and_does_not_resurrect_stock(): void
    {
        [$v,$o,$owner,$d] = $this->quoted();
        $a = new Actor(null, 'guest-fixture');
        $p = app(CreateRazorpayAttempt::class)->execute($o, $d, $a, 'payment-fixture-key-001');
        $this->travel(2)->days();
        app(ExpireReservations::class)->execute();
        app(SettleOrderPayment::class)->execute($p, ['id' => 'late', 'order_id' => $p->provider_order_id, 'amount' => $p->amount_minor, 'currency' => 'INR', 'status' => 'captured'], $a);
        $this->assertSame('exception', $o->refresh()->payment_status);
        $this->assertSame('expired', $o->status);
        $this->assertSame(5, Balance::where('variant_id', $v->id)->first()->on_hand);
    }

    public function test_manual_claim_stays_unpaid_until_owner_verifies_exact_received_funds(): void
    {
        [$v,$o,$owner,$d] = $this->quoted();
        $a = new Actor(null, 'guest-fixture');
        $e = app(SubmitManualEvidence::class)->execute($o, $d + ['reference' => 'synthetic-reference'], $a);
        $this->assertSame('under_review', $o->refresh()->payment_status);
        $this->assertSame(5, Balance::where('variant_id', $v->id)->first()->on_hand);
        $paid = app(ReviewManualPayment::class)->execute($e, ['expected_version' => $o->version, 'bank_reference' => 'SYNTHETIC-BANK-1', 'received_amount_minor' => $o->total_minor, 'received_at' => now()->toISOString()], new Actor($owner, 'owner'), true);
        $this->assertSame('paid', $paid->payment_status);
        $this->assertSame(4, Balance::where('variant_id', $v->id)->first()->on_hand);
    }

    public function test_unpaid_dispatch_is_rejected(): void
    {
        [$v,$o,$owner,$d] = $this->quoted();
        $this->expectException(ApiError::class);
        app(TransitionFulfillment::class)->execute($o, 'shipment', ['expected_version' => $o->version, 'carrier' => 'Fixture', 'tracking_number' => 'SYNTHETIC'], new Actor($owner, 'owner'));
    }
}
