<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

final class Idempotency
{
    public function execute(string $scope, string $key, array $input, callable $work): array
    {
        ApiError::ensure(strlen($key) >= 16 && strlen($key) <= 128, 'VALIDATION_ERROR', 'Provide an Idempotency-Key of 16–128 characters.', 422);
        $hash = hash('sha256', json_encode($input, JSON_THROW_ON_ERROR));

        return DB::transaction(function () use ($scope, $key, $hash, $work) {
            DB::table('idempotency_records')->insertOrIgnore(['scope' => $scope, 'key' => $key, 'payload_hash' => $hash, 'created_at' => now(), 'expires_at' => now()->addDays(8)]);
            $row = DB::table('idempotency_records')->where(compact('scope', 'key'))->lockForUpdate()->first();
            ApiError::ensure(hash_equals($row->payload_hash, $hash), 'IDEMPOTENCY_CONFLICT', 'This retry key belongs to different input.');
            if ($row->response !== null) {
                return json_decode($row->response, true, 512, JSON_THROW_ON_ERROR);
            }
            $response = $work();
            DB::table('idempotency_records')->where('id', $row->id)->update(['response' => json_encode($response, JSON_THROW_ON_ERROR)]);

            return $response;
        }, 3);
    }
}
