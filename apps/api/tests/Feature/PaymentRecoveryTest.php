<?php

namespace Tests\Feature;

use App\Modules\Commerce\Actions\IssueShippingQuote;
use App\Modules\Commerce\Actions\ManageCart;
use App\Modules\Commerce\Models\Quote;
use App\Modules\Identity\Actions\ChangeStaffMembership;
use App\Modules\Identity\Models\Invitation;
use App\Modules\Identity\Models\StaffMembership;
use App\Modules\Inventory\Models\Balance;
use App\Modules\Payments\Actions\CreateRazorpayAttempt;
use App\Modules\Payments\Actions\ObserveProviderPayments;
use App\Modules\Payments\Actions\RequestRefund;
use App\Modules\Payments\Actions\ReviewManualPayment;
use App\Modules\Payments\Actions\SubmitManualEvidence;
use App\Modules\Payments\Contracts\RazorpayGateway;
use App\Support\Actor;
use App\Support\ApiError;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Support\FakeGateway;
use Tests\Support\StudioFixtures;
use Tests\TestCase;

final class PaymentRecoveryTest extends TestCase
{
    use RefreshDatabase, StudioFixtures;

    private function scenario(): array
    {
        $this->configureCommerce();
        app()->instance(RazorpayGateway::class, new FakeGateway);
        $v = $this->variant();
        $owner = $this->person('owner');
        $actor = new Actor($owner, 'owner');
        $o = $this->order($v);
        $o = app(IssueShippingQuote::class)->execute($o, ['expected_version' => 1, 'shipping_minor' => 5000, 'expires_at' => now()->addHours(20)->toISOString()], $actor);
        $q = Quote::findOrFail($o->current_quote_id);

        return [$v, $o, $actor, ['quote_id' => $q->public_id, 'quote_version' => 1, 'accept_quote' => true]];
    }

    public function test_authorized_and_delayed_failure_cannot_report_paid_or_regress_capture(): void
    {
        [$v,$o,$owner,$quote] = $this->scenario();
        $p = app(CreateRazorpayAttempt::class)->execute($o, $quote, new Actor(null, 'guest-fixture'), 'synthetic-payment-key');
        $facts = ['id' => 'pay_synthetic', 'order_id' => $p->provider_order_id, 'amount' => $p->amount_minor, 'currency' => 'INR', 'status' => 'authorized'];
        $action = app(ObserveProviderPayments::class);
        $this->assertSame('authorized', $action->execute($p, [$facts])->status);
        $this->assertNotEquals('paid', $o->refresh()->payment_status);
        $facts['status'] = 'captured';
        $action->execute($p, [$facts]);
        $facts['status'] = 'failed';
        $action->execute($p, [$facts]);
        $this->assertSame('paid', $o->refresh()->payment_status);
        $this->assertSame(4, Balance::where('variant_id', $v->id)->first()->on_hand);
        $this->assertDatabaseCount('payment_receipts', 1);
    }

    public function test_failed_attempt_allows_a_new_attempt_but_mixed_authorization_blocks_it(): void
    {
        [$v,$o,$owner,$quote] = $this->scenario();
        $guest = new Actor(null, 'guest-fixture');
        $p = app(CreateRazorpayAttempt::class)->execute($o, $quote, $guest, 'synthetic-payment-key');
        $facts = ['id' => 'pay_synthetic', 'order_id' => $p->provider_order_id, 'amount' => $p->amount_minor, 'currency' => 'INR', 'status' => 'failed'];
        app(ObserveProviderPayments::class)->execute($p, [$facts]);
        $this->assertSame('unpaid', $o->refresh()->payment_status);
        $next = app(CreateRazorpayAttempt::class)->execute($o, $quote, $guest, 'synthetic-payment-key-2');
        $this->assertNotSame($p->id, $next->id);
        $this->expectException(ApiError::class);
        app(CreateRazorpayAttempt::class)->execute($o, $quote, $guest, 'synthetic-payment-key-3');
    }

    public function test_excess_capture_refund_preserves_original_paid_order_and_does_not_restock(): void
    {
        [$v,$o,$owner,$quote] = $this->scenario();
        $p = app(CreateRazorpayAttempt::class)->execute($o, $quote, new Actor(null, 'guest-fixture'), 'synthetic-payment-key');
        $facts = ['id' => 'pay_first', 'order_id' => $p->provider_order_id, 'amount' => $p->amount_minor, 'currency' => 'INR', 'status' => 'captured'];
        app(ObserveProviderPayments::class)->execute($p, [$facts]);
        $facts['id'] = 'pay_extra';
        app(ObserveProviderPayments::class)->execute($p, [$facts]);
        $this->assertSame('exception', $o->refresh()->payment_status);
        $receipt = DB::table('payment_receipts')->where('external_id', 'razorpay:pay_extra')->first();
        $refund = app(RequestRefund::class)->create($o, ['expected_version' => $o->version, 'payment_attempt_id' => $p->public_id, 'payment_receipt_id' => $receipt->public_id, 'reason' => 'Synthetic duplicate capture'], $owner);
        app(RequestRefund::class)->send($refund);
        $this->assertSame('succeeded', $refund->refresh()->status);
        $this->assertSame('paid', $o->refresh()->payment_status);
        $this->assertSame(4, Balance::where('variant_id', $v->id)->first()->on_hand);
    }

    public function test_manual_receipt_retains_actual_received_timestamp_for_reporting(): void
    {
        [$v,$o,$owner,$quote] = $this->scenario();
        $e = app(SubmitManualEvidence::class)->execute($o, $quote + ['reference' => 'SYNTHETIC-REFERENCE'], new Actor(null, 'guest-fixture'));
        $received = now()->subHours(2)->startOfSecond();
        app(ReviewManualPayment::class)->execute($e, ['expected_version' => $o->refresh()->version, 'bank_reference' => 'SYNTHETIC-BANK', 'received_amount_minor' => $o->total_minor, 'received_at' => $received->toISOString()], $owner, true);
        $this->assertSame($received->toDateTimeString(), DB::table('payment_receipts')->value('received_at'));
    }

    public function test_cart_price_change_requires_review_and_returns_a_new_version(): void
    {
        $v = $this->variant();
        $a = new Actor(null, 'synthetic-cart');
        $c = app(ManageCart::class);
        $view = $c->mutate($a, ['expected_version' => 1, 'variant_id' => $v->public_id, 'quantity' => 1], 'POST');
        $v->update(['price_minor' => 40000]);
        $cart = $c->reviewPrices($c->cart($a));
        $this->assertSame($view['version'] + 1, $cart->version);
        $this->assertSame(40000, $c->project($cart)['subtotal_minor']);
        $this->assertSame(40000, DB::table('cart_items')->value('unit_price_minor'));
    }

    public function test_membership_change_revokes_pending_invitations_for_that_account(): void
    {
        $owner = $this->person('owner');
        $staff = $this->person('fulfillment');
        $i = Invitation::create(['email' => $staff->email, 'name' => 'Synthetic', 'role' => 'owner', 'token_hash' => hash('sha256', 'fixture'), 'expires_at' => now()->addHour()]);
        $m = StaffMembership::where('user_id', $staff->id)->firstOrFail();
        app(ChangeStaffMembership::class)->execute($m->public_id, ['expected_version' => 1, 'active' => false], new Actor($owner, 'owner'));
        $this->assertNotNull($i->refresh()->revoked_at);
    }
}
