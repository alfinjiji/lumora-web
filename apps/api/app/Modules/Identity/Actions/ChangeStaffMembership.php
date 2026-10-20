<?php

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Models\StaffMembership;
use App\Support\Actor;
use App\Support\ApiError;
use App\Support\Audit;
use App\Support\Version;
use Illuminate\Support\Facades\DB;

final class ChangeStaffMembership
{
    public function execute(string $id, array $data, Actor $actor): StaffMembership
    {
        $actor->owner();

        return DB::transaction(function () use ($id, $data, $actor) {
            DB::table('identity_locks')->where('name', 'owners')->lockForUpdate()->first();
            $actor->owner();
            $member = StaffMembership::where('public_id', $id)->lockForUpdate()->firstOrFail();
            Version::check($member, $data['expected_version']);
            $role = $data['role'] ?? $member->role;
            $active = $data['active'] ?? $member->active;
            if ($member->role === 'owner' && $member->active && (! $active || $role !== 'owner')) {
                $owners = StaffMembership::join('users', 'users.id', '=', 'staff_memberships.user_id')->where('staff_memberships.role', 'owner')->where('staff_memberships.active', true)->where('users.active', true)->whereNotNull('users.email_verified_at')->count();
                ApiError::ensure($owners > 1, 'LAST_OWNER', 'At least one active verified owner must remain.');
            }
            $member->update(['role' => $role, 'active' => $active, 'version' => $member->version + 1]);
            DB::table('sessions')->where('user_id', $member->user_id)->delete();
            $email = DB::table('users')->where('id', $member->user_id)->value('email');
            DB::table('invitations')->where('email', $email)->whereNull('accepted_at')->whereNull('revoked_at')->update(['revoked_at' => now()]);
            Audit::write($actor, 'membership.changed', 'membership', $id);

            return $member;
        }, 3);
    }
}
