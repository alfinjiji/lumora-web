<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class Audit
{
    public static function write(Actor $actor, string $action, string $type, string $id): void
    {
        DB::table('audit_logs')->insert(['public_id' => (string) Str::ulid(), 'actor_id' => $actor->user?->id, 'action' => $action, 'entity_type' => $type, 'entity_id' => $id, 'request_id' => request()?->header('X-Request-ID'), 'created_at' => now()]);
    }

    public static function outbox(string $key, string $type, array $payload): void
    {
        DB::table('outbox_messages')->insertOrIgnore(['public_id' => (string) Str::ulid(), 'effect_key' => $key, 'type' => $type, 'payload' => json_encode($payload, JSON_THROW_ON_ERROR), 'status' => 'pending', 'attempts' => 0, 'created_at' => now(), 'updated_at' => now()]);
    }
}
