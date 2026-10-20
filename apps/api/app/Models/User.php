<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property string $name
 * @property string $email
 * @property Carbon|null $email_verified_at
 * @property string $password
 * @property string|null $remember_token
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property string $public_id
 * @property bool $active
 * @property string|null $phone
 * @property string|null $bio
 * @property int|null $avatar_media_id
 * @property int $version
 */
class User extends Authenticatable
{
    use HasFactory,Notifiable;

    protected $attributes = ['active' => true, 'version' => 1];

    protected $guarded = ['id'];

    protected $hidden = ['password', 'remember_token'];

    protected static function booted(): void
    {
        static::creating(fn ($u) => $u->public_id ??= (string) Str::ulid());
    }

    protected function casts(): array
    {
        return ['email_verified_at' => 'datetime', 'password' => 'hashed', 'active' => 'boolean', 'version' => 'integer'];
    }
}
