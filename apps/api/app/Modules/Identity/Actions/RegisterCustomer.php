<?php

namespace App\Modules\Identity\Actions;

use App\Models\User;
use App\Support\ApiError;
use Illuminate\Support\Facades\DB;

final class RegisterCustomer
{
    public function execute(array $data): User
    {
        return DB::transaction(function () use ($data) {
            ApiError::ensure(! User::where('email', $data['email'])->exists(), 'EMAIL_UNAVAILABLE', 'This email cannot be used for a new account.', 422);
            $user = User::create(['name' => $data['name'], 'email' => $data['email'], 'password' => $data['password']]);
            app(IssueToken::class)->execute('verify', $user->email);

            return $user;
        });
    }
}
