<?php

namespace App\Modules\Identity\Actions;

use App\Models\User;
use App\Modules\Identity\Models\Invitation;
use App\Modules\Identity\Models\StaffMembership;
use App\Support\Actor;
use App\Support\ApiError;
use App\Support\Audit;
use Illuminate\Support\Facades\DB;

final class AcceptStaffInvitation
{
    public function execute(array $data, Actor $actor): User
    {
        return DB::transaction(function () use ($data, $actor) {
            DB::table('identity_locks')->where('name', 'owners')->lockForUpdate()->first();
            $inv = Invitation::where('token_hash', hash('sha256', $data['token']))->lockForUpdate()->first();
            ApiError::ensure($inv && ! $inv->accepted_at && ! $inv->revoked_at && $inv->expires_at->isFuture(), 'INVALID_TOKEN', 'This invitation is invalid or expired.', 422);
            $user = User::where('email', $inv->email)->lockForUpdate()->first();
            if ($user) {
                ApiError::ensure($actor->user?->id === $user->id, 'AUTHENTICATION_REQUIRED', 'Sign in as the invited email to accept.', 403);
                ApiError::ensure($user->active, 'FORBIDDEN', 'This account is inactive.', 403);
            } else {
                ApiError::ensure(! empty($data['name']) && strlen($data['password'] ?? '') >= 12 && ($data['password'] ?? null) === ($data['password_confirmation'] ?? null), 'VALIDATION_ERROR', 'Name and matching new passwords are required.', 422);
                $user = User::create(['name' => $data['name'], 'email' => $inv->email, 'password' => $data['password']]);
            }
            $user->update(['email_verified_at' => now()]);
            StaffMembership::updateOrCreate(['user_id' => $user->id], ['role' => $inv->role, 'active' => true]);
            $inv->update(['accepted_at' => now()]);
            Audit::write(new Actor($user, $actor->sessionId), 'invitation.accepted', 'invitation', $inv->public_id);

            return $user;
        }, 3);
    }
}
