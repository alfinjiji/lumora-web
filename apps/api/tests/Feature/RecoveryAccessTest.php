<?php

namespace Tests\Feature;

use App\Modules\Commerce\Actions\SubmitOrderRequest;
use App\Modules\Commerce\Data\SubmitOrderData;
use App\Modules\Identity\Actions\IssueToken;
use App\Modules\Media\Actions\ScanProof;
use App\Support\Actor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\Support\StudioFixtures;
use Tests\TestCase;

final class RecoveryAccessTest extends TestCase
{
    use RefreshDatabase,StudioFixtures;

    private function token(): string
    {
        $p = json_decode(DB::table('outbox_messages')->orderByDesc('id')->value('payload'), true);

        return Crypt::decryptString($p['token']);
    }

    public function test_reset_revokes_other_recovery_links_and_replay_is_rejected(): void
    {
        $u = $this->person();
        app(IssueToken::class)->execute('reset', $u->email);
        $first = $this->token();
        app(IssueToken::class)->execute('reset', $u->email);
        $second = $this->token();
        $data = ['email' => $u->email, 'token' => $second, 'password' => 'Replacement-Synthetic-Password!', 'password_confirmation' => 'Replacement-Synthetic-Password!'];
        $this->postJson('/auth/reset-password', $data)->assertOk();
        $this->assertTrue(Hash::check($data['password'], $u->refresh()->password));
        $this->postJson('/auth/reset-password', $data)->assertStatus(422);
        $this->postJson('/auth/reset-password', array_replace($data, ['token' => $first]))->assertStatus(422);
    }

    public function test_guest_exchange_grants_only_one_order_and_verified_customer_claim_is_explicit(): void
    {
        $this->configureCommerce();
        $o = $this->order($this->variant());
        $this->getJson('/api/v1/orders/'.$o->public_id)->assertNotFound();
        app(IssueToken::class)->execute('guest-order', $o->contact['email'], ['order_id' => $o->id]);
        $raw = $this->token();
        $this->postJson('/api/v1/guest-order-access/exchange', ['token' => $raw])->assertOk()->assertJsonPath('data.order_id', $o->public_id);
        $this->withCredentials()->withCookie(config('session.cookie'), session()->getId());
        $this->postJson('/api/v1/guest-order-access/exchange', ['token' => $raw])->assertStatus(422);
        $this->getJson('/api/v1/orders/'.$o->public_id)->assertOk();
        $u = $this->person();
        $u->update(['email' => $o->contact['email'], 'email_verified_at' => null]);
        $this->actingAs($u)->postJson('/api/v1/orders/'.$o->public_id.'/claim')->assertForbidden();
        $u->update(['email_verified_at' => now()]);
        $this->postJson('/api/v1/orders/'.$o->public_id.'/claim')->assertOk();
        $this->assertSame($u->id, $o->refresh()->user_id);
    }

    public function test_direct_order_is_not_assigned_to_the_staff_member_creating_it(): void
    {
        $this->configureCommerce();
        $staff = $this->person('fulfillment');
        $v = $this->variant();
        $o = app(SubmitOrderRequest::class)->execute(new SubmitOrderData($this->contact(), $this->address(), [['variant_id' => $v->public_id, 'quantity' => 1]], 'phone'), new Actor($staff, 'staff'));
        $this->assertNull($o->user_id);
        $this->assertSame('phone', $o->source);
    }

    public function test_scanner_failures_and_infected_proofs_never_become_clean(): void
    {
        $this->assertSame('clean', ScanProof::parseReply("stream: OK\0"));
        $this->assertSame('infected', ScanProof::parseReply("stream: Eicar-Test-Signature FOUND\0"));
        foreach (['', 'stream: error', 'some prefix stream: OK', 'stream: OK but not really'] as $reply) {
            $this->assertSame('pending', ScanProof::parseReply($reply));
        }
        config(['auraflare.proof_scanner' => 'disabled']);
        $this->assertFalse(app(ScanProof::class)->execute('synthetic bytes'));
    }
}
