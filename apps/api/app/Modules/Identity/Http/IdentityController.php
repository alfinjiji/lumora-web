<?php

namespace App\Modules\Identity\Http;

use App\Models\User;
use App\Modules\Commerce\Actions\ManageCart;
use App\Modules\Identity\Actions\AcceptStaffInvitation;
use App\Modules\Identity\Actions\ChangeStaffMembership;
use App\Modules\Identity\Actions\ConsumeToken;
use App\Modules\Identity\Actions\IssueToken;
use App\Modules\Identity\Actions\RegisterCustomer;
use App\Modules\Identity\Actions\RevokeInvitation;
use App\Modules\Identity\Models\Address;
use App\Modules\Identity\Models\Invitation;
use App\Modules\Identity\Models\StaffMembership;
use App\Support\Actor;
use App\Support\ApiError;
use App\Support\Audit;
use App\Support\ContractRequest;
use App\Support\Http\ApiController;
use App\Support\Version;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

final class IdentityController extends ApiController
{
    public static function user(User $u): array
    {
        $role = DB::table('staff_memberships')->where('user_id', $u->id)->where('active', true)->value('role');

        return ['id' => $u->public_id, 'name' => $u->name, 'email' => $u->email, 'email_verified' => (bool) $u->email_verified_at, 'phone' => $u->phone, 'bio' => $u->bio, 'avatar_url' => $u->avatar_media_id ? url('/media/avatar/'.$u->public_id) : null, 'staff_role' => $role, 'permissions' => $role === 'owner' ? ['catalog.write', 'inventory.write', 'orders.manage', 'finance.manage', 'content.publish', 'team.manage'] : ($role === 'fulfillment' ? ['inventory.write', 'orders.manage', 'enquiries.manage'] : []), 'version' => $u->version];
    }

    public function register(ContractRequest $r)
    {
        $u = app(RegisterCustomer::class)->execute($r->validated());
        $this->signIn($r, $u);

        return $this->ok(self::user($u), 201);
    }

    private function signIn(Request $r, User $u): void
    {
        $previous = $r->session()->getId();
        Auth::login($u, (bool) $r->input('remember', false));
        $r->session()->regenerate();
        app(ManageCart::class)->merge($previous, $r->session()->getId(), $u);
    }

    public function login(ContractRequest $r)
    {
        $d = $r->validated();
        $u = User::where('email', $d['email'])->first();
        ApiError::ensure($u && Hash::check($d['password'], $u->password) && $u->active, 'INVALID_CREDENTIALS', 'Email or password is incorrect.', 401);
        $this->signIn($r, $u);

        return $this->ok(self::user($u));
    }

    public function logout(Request $r)
    {
        Auth::logout();
        $r->session()->invalidate();
        $r->session()->regenerateToken();

        return response()->noContent();
    }

    public function me(Request $r)
    {
        return $this->ok(self::user($r->user()));
    }

    public function profile(ContractRequest $r)
    {
        $d = $r->validated();
        $u = DB::transaction(function () use ($r, $d) {
            $u = User::whereKey($r->user()->id)->lockForUpdate()->firstOrFail();
            Version::check($u, $d['expected_version']);
            $u->fill(array_intersect_key($d, array_flip(['name', 'phone', 'bio'])));
            $u->version++;
            $u->save();

            return $u;
        });

        return $this->ok(self::user($u));
    }

    public function password(ContractRequest $r)
    {
        $d = $r->validated();
        DB::transaction(function () use ($r, $d) {
            $u = User::whereKey($r->user()->id)->lockForUpdate()->firstOrFail();
            ApiError::ensure(Hash::check($d['current_password'], $u->password), 'CURRENT_PASSWORD_INVALID', 'Current password is incorrect.', 422);
            $u->update(['password' => $d['password'], 'remember_token' => null]);
            DB::table('sessions')->where('user_id', $u->id)->where('id', '!=', $r->session()->getId())->delete();
            DB::table('access_tokens')->where('email', $u->email)->whereNull('used_at')->update(['used_at' => now()]);
        });

        return $this->ack();
    }

    public function forgot(ContractRequest $r)
    {
        $email = $r->validated()['email'];
        if (User::where('email', $email)->where('active', true)->exists()) {
            app(IssueToken::class)->execute('reset', $email);
        }

        return $this->ack(202);
    }

    public function reset(ContractRequest $r)
    {
        $d = $r->validated();
        app(ConsumeToken::class)->execute('reset', $d['token'], function ($t) use ($d) {
            ApiError::ensure($t->email === $d['email'], 'INVALID_TOKEN', 'Invalid recovery link.', 422);
            $u = User::where('email', $t->email)->lockForUpdate()->firstOrFail();
            $u->update(['password' => $d['password'], 'remember_token' => null]);
            DB::table('sessions')->where('user_id', $u->id)->delete();
            DB::table('access_tokens')->where('email', $u->email)->where('purpose', 'reset')->whereNull('used_at')->update(['used_at' => now()]);
        });

        return $this->ack();
    }

    public function verifyRequest(Request $r)
    {
        if (! $r->user()->email_verified_at) {
            app(IssueToken::class)->execute('verify', $r->user()->email);
        }

        return $this->ack(202);
    }

    public function verify(ContractRequest $r)
    {
        app(ConsumeToken::class)->execute('verify', $r->validated()['token'], fn ($t) => User::where('email', $t->email)->update(['email_verified_at' => now()]));

        return $this->ack();
    }

    public function emailChange(ContractRequest $r)
    {
        $d = $r->validated();
        ApiError::ensure(Hash::check($d['current_password'], $r->user()->password), 'CURRENT_PASSWORD_INVALID', 'Current password is incorrect.', 422);
        ApiError::ensure(! User::where('email', $d['email'])->exists(), 'EMAIL_UNAVAILABLE', 'This address cannot be used.', 422);
        app(IssueToken::class)->execute('email-change', $d['email'], ['user_id' => $r->user()->id]);

        return $this->ack(202);
    }

    public function emailConfirm(ContractRequest $r)
    {
        $u = app(ConsumeToken::class)->execute('email-change', $r->validated()['token'], function ($t) use ($r) {
            ApiError::ensure(($t->payload['user_id'] ?? null) === $r->user()->id, 'FORBIDDEN', 'Wrong account.', 403);
            $u = $r->user();
            $u->update(['email' => $t->email, 'email_verified_at' => now(), 'version' => $u->version + 1]);
            DB::table('sessions')->where('user_id', $u->id)->where('id', '!=', $r->session()->getId())->delete();

            return $u;
        });

        return $this->ok(self::user($u));
    }

    public function accept(ContractRequest $r)
    {
        $u = app(AcceptStaffInvitation::class)->execute($r->validated(), Actor::request());
        $this->signIn($r, $u);

        return $this->ok(self::user($u));
    }

    public function addresses(Request $r)
    {
        return $this->listing(Address::where('user_id', $r->user()->id)->orderBy('id'), fn ($a) => ['id' => $a->public_id] + $a->only(['line1', 'line2', 'city', 'state_code', 'postcode', 'country_code']));
    }

    public function addressSave(ContractRequest $r, ?string $addressId = null)
    {
        $a = $addressId ? Address::where('user_id', $r->user()->id)->where('public_id', $addressId)->firstOrFail() : new Address(['user_id' => $r->user()->id]);
        $a->fill($r->validated())->save();

        return $this->ok(['id' => $a->public_id] + $a->only(['line1', 'line2', 'city', 'state_code', 'postcode', 'country_code']), $addressId ? 200 : 201);
    }

    public function addressDelete(Request $r, string $addressId)
    {
        Address::where('user_id', $r->user()->id)->where('public_id', $addressId)->firstOrFail()->delete();

        return response()->noContent();
    }

    public static function member(StaffMembership $m): array
    {
        return ['id' => $m->public_id, 'user' => self::user(User::findOrFail($m->user_id)), 'role' => $m->role, 'active' => $m->active, 'version' => $m->version];
    }

    public function assignees()
    {
        return $this->listing(User::where('active', true)->whereNotNull('email_verified_at')->whereIn('id', DB::table('staff_memberships')->where('active', true)->select('user_id'))->orderBy('id'), fn ($u) => ['id' => $u->public_id, 'name' => $u->name]);
    }

    public function team()
    {
        return $this->listing(StaffMembership::orderBy('id'), fn ($m) => self::member($m));
    }

    public function memberUpdate(ContractRequest $r, string $memberId)
    {
        return $this->ok(self::member(app(ChangeStaffMembership::class)->execute($memberId, $r->validated(), Actor::request())));
    }

    public static function invitation(Invitation $i): array
    {
        return ['id' => $i->public_id, 'email' => $i->email, 'role' => $i->role, 'expires_at' => $i->expires_at->toISOString(), 'status' => $i->accepted_at ? 'accepted' : ($i->revoked_at ? 'revoked' : ($i->expires_at->isPast() ? 'expired' : 'pending'))];
    }

    public function invitations()
    {
        return $this->listing(Invitation::orderByDesc('id'), fn ($i) => self::invitation($i));
    }

    public function invite(ContractRequest $r)
    {
        $d = $r->validated();
        $i = DB::transaction(function () use ($d) {
            $raw = bin2hex(random_bytes(32));
            $i = Invitation::create($d + ['token_hash' => hash('sha256', $raw), 'expires_at' => now()->addHours(72), 'invited_by' => auth()->id()]);
            Audit::outbox('invite:'.$i->public_id, 'invitation', ['email' => $d['email'], 'token' => \Crypt::encryptString($raw)]);
            Audit::write(Actor::request(), 'invitation.created', 'invitation', $i->public_id);

            return $i;
        });

        return $this->ok(self::invitation($i), 201);
    }

    public function revoke(string $invitationId)
    {
        return $this->ok(self::invitation(app(RevokeInvitation::class)->execute($invitationId, Actor::request())));
    }
}
