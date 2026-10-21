<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Facades\DB;

final readonly class Actor
{
    public function __construct(public ?User $user, public string $sessionId) {}

    public static function request(): self
    {
        return new self(request()->user(), request()->session()->getId());
    }

    public function role(): ?string
    {
        return $this->user ? DB::table('staff_memberships')->where('user_id', $this->user->id)->where('active', true)->value('role') : null;
    }

    public function staff(): void
    {
        ApiError::ensure((bool) $this->user, 'UNAUTHENTICATED', 'Sign in to continue.', 401);
        ApiError::ensure($this->user && $this->user->active && $this->user->email_verified_at && $this->role(), 'FORBIDDEN', 'Active verified studio access is required.', 403);
    }

    public function owner(): void
    {
        $this->staff();
        ApiError::ensure($this->role() === 'owner', 'FORBIDDEN', 'Only owners can perform this action.', 403);
    }
}
