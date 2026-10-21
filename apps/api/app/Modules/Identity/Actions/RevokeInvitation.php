<?php

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Models\Invitation;
use App\Support\Actor;
use App\Support\ApiError;
use App\Support\Audit;
use Illuminate\Support\Facades\DB;

final class RevokeInvitation
{
    public function execute(string $id, Actor $actor): Invitation
    {
        $actor->owner();

        return DB::transaction(function () use ($id, $actor) {
            $invitation = Invitation::where('public_id', $id)->lockForUpdate()->firstOrFail();
            $actor->owner();
            ApiError::ensure(! $invitation->accepted_at, 'INVALID_TRANSITION', 'This invitation was already accepted. Change access through Team & access.');
            if (! $invitation->revoked_at) {
                $invitation->update(['revoked_at' => now()]);
                Audit::write($actor, 'invitation.revoked', 'invitation', $invitation->public_id);
            }

            return $invitation;
        }, 3);
    }
}
