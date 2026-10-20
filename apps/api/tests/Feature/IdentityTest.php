<?php

namespace Tests\Feature;

use App\Models\User;
use App\Modules\Identity\Actions\AcceptStaffInvitation;
use App\Modules\Identity\Actions\ChangeStaffMembership;
use App\Modules\Identity\Models\Invitation;
use App\Modules\Identity\Models\StaffMembership;
use App\Support\Actor;
use App\Support\ApiError;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\Support\StudioFixtures;
use Tests\TestCase;

final class IdentityTest extends TestCase
{
    use RefreshDatabase,StudioFixtures;

    public function test_protected_operations_reject_anonymous_and_customer_accounts(): void
    {
        $spec = json_decode(file_get_contents(resource_path('contract.json')), true);
        $customer = $this->person();
        foreach ($spec['paths'] as $path => $ops) {
            foreach ($ops as $method => $op) {
                if (! in_array($op['x-capability'] ?? null, ['owner', 'staff'])) {
                    continue;
                }$url = preg_replace('/\{[^}]+\}/', '01K7XB0X9PHZ2NE0GDS4B4YDKH', $path);
                $this->json(strtoupper($method), $url, [])->assertStatus(401);
                $this->actingAs($customer)->json(strtoupper($method), $url, [])->assertStatus(403);
                auth()->forgetGuards();
            }
        }
    }

    public function test_registration_normalizes_email_never_accepts_a_role_and_hashes_password(): void
    {
        $data = ['name' => 'Fixture', 'email' => 'Customer@Example.test', 'password' => 'Synthetic-Password-2026!', 'password_confirmation' => 'Synthetic-Password-2026!', 'accept_terms' => true];
        $this->postJson('/auth/register', $data + ['role' => 'owner'])->assertStatus(422);
        $this->postJson('/auth/register', $data)->assertCreated()->assertJsonPath('data.staff_role', null);
        $user = User::firstOrFail();
        $this->assertSame('customer@example.test', $user->email);
        $this->assertTrue(Hash::check($data['password'], $user->password));
        $this->assertNotEquals($data['password'], $user->password);
        $this->assertDatabaseCount('outbox_messages', 1);
    }

    public function test_wrong_login_and_recovery_do_not_disclose_account_existence(): void
    {
        $u = $this->person();
        $this->postJson('/auth/login', ['email' => $u->email, 'password' => 'wrong'])->assertStatus(401);
        $a = $this->postJson('/auth/forgot-password', ['email' => $u->email])->assertStatus(202)->json();
        $b = $this->postJson('/auth/forgot-password', ['email' => 'absent@example.test'])->assertStatus(202)->json();
        $this->assertSame($a['data'], $b['data']);
    }

    public function test_invitation_requires_existing_user_identity_and_cannot_reset_their_password(): void
    {
        $existing = $this->person();
        $raw = bin2hex(random_bytes(32));
        $i = Invitation::create(['email' => $existing->email, 'name' => 'Fixture', 'role' => 'owner', 'token_hash' => hash('sha256', $raw), 'expires_at' => now()->addHour()]);
        try {
            app(AcceptStaffInvitation::class)->execute(['token' => $raw, 'password' => 'Attacker-Password-2026!'], new Actor(null, 'attacker'));
            $this->fail('Wrong account accepted');
        } catch (ApiError $e) {
            $this->assertSame(403, $e->status);
        } $before = $existing->password;
        app(AcceptStaffInvitation::class)->execute(['token' => $raw], new Actor($existing, 'verified-account'));
        $this->assertSame($before, $existing->refresh()->password);
        $this->assertNotNull($i->refresh()->accepted_at);
        $this->expectException(ApiError::class);
        app(AcceptStaffInvitation::class)->execute(['token' => $raw], new Actor($existing, 'verified-account'));
    }

    public function test_last_active_owner_is_protected_even_with_pending_invitation(): void
    {
        $u = $this->person('owner');
        Invitation::create(['email' => 'pending@example.test', 'name' => 'Pending', 'role' => 'owner', 'token_hash' => hash('sha256', 'pending'), 'expires_at' => now()->addHour()]);
        $m = StaffMembership::where('user_id', $u->id)->firstOrFail();
        $this->expectException(ApiError::class);
        app(ChangeStaffMembership::class)->execute($m->public_id, ['expected_version' => 1, 'active' => false], new Actor($u, 'owner-session'));
    }

    public function test_staff_owner_capabilities_are_enforced_before_input_validation(): void
    {
        $u = $this->person('fulfillment');
        $this->actingAs($u)->getJson('/api/v1/admin/inventory')->assertOk();
        $this->postJson('/api/v1/admin/products', [])->assertForbidden();
        $this->postJson('/api/v1/admin/invitations', [])->assertForbidden();
        $this->putJson('/api/v1/admin/content/home', [])->assertForbidden();
    }

    public function test_password_change_requires_current_verification(): void
    {
        $u = $this->person();
        $this->actingAs($u)->putJson('/api/v1/me/password', ['current_password' => 'wrong', 'password' => 'New-Synthetic-Password!', 'password_confirmation' => 'New-Synthetic-Password!'])->assertStatus(422);
        $this->putJson('/api/v1/me/password', ['current_password' => 'Synthetic-Password-2026!', 'password' => 'New-Synthetic-Password!', 'password_confirmation' => 'New-Synthetic-Password!'])->assertOk();
        $this->assertTrue(Hash::check('New-Synthetic-Password!', $u->refresh()->password));
    }

    public function test_deactivated_membership_immediately_removes_access(): void
    {
        $owner = $this->person('owner');
        $staff = $this->person('fulfillment');
        $m = StaffMembership::where('user_id', $staff->id)->firstOrFail();
        app(ChangeStaffMembership::class)->execute($m->public_id, ['expected_version' => 1, 'active' => false], new Actor($owner, 'owner-session'));
        $this->actingAs($staff)->getJson('/api/v1/admin/orders')->assertForbidden();
    }

    public function test_invitation_revocation_is_audited_once_and_cannot_rewrite_acceptance(): void
    {
        $owner = $this->person('owner');
        $raw = bin2hex(random_bytes(32));
        $invite = Invitation::create(['email' => 'new-invitee@example.test', 'name' => 'Synthetic invitee', 'role' => 'fulfillment', 'token_hash' => hash('sha256', $raw), 'expires_at' => now()->addHour()]);
        $url = '/api/v1/admin/invitations/'.$invite->public_id.'/revoke';
        $this->actingAs($owner)->postJson($url)->assertOk()->assertJsonPath('data.status', 'revoked');
        $this->postJson($url)->assertOk();
        $this->assertSame(1, DB::table('audit_logs')->where('action', 'invitation.revoked')->count());
        $this->postJson('/auth/invitations/accept', ['token' => $raw, 'name' => 'Synthetic invitee', 'password' => 'Synthetic-Invite-Password!', 'password_confirmation' => 'Synthetic-Invite-Password!'])->assertStatus(422);
        $accepted = Invitation::create(['email' => 'accepted@example.test', 'name' => 'Synthetic accepted', 'role' => 'fulfillment', 'token_hash' => hash('sha256', 'accepted'), 'expires_at' => now()->addHour(), 'accepted_at' => now()]);
        $this->postJson('/api/v1/admin/invitations/'.$accepted->public_id.'/revoke')->assertStatus(409);
        $this->assertNull($accepted->refresh()->revoked_at);
    }
}
