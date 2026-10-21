<?php

namespace App\Modules\Inventory\Actions;

use App\Modules\Catalog\Models\Variant;
use App\Modules\Inventory\Models\Balance;
use App\Modules\Inventory\Models\Movement;
use App\Support\Actor;
use App\Support\ApiError;
use App\Support\Audit;
use App\Support\Version;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class AdjustInventory
{
    public function execute(string $id, array $data, Actor $actor): Balance
    {
        $actor->staff();

        return DB::transaction(function () use ($id, $data, $actor) {
            $v = Variant::where('public_id', $id)->firstOrFail();
            $b = Balance::where('variant_id', $v->id)->lockForUpdate()->firstOrFail();
            Version::check($b, $data['expected_version']);
            $next = $b->on_hand + $data['on_hand_delta'];
            ApiError::ensure($next >= $b->reserved, 'INSUFFICIENT_STOCK', 'Physical stock cannot be lower than reserved stock.');
            $b->update(['on_hand' => $next, 'version' => $b->version + 1]);
            Movement::create(['variant_id' => $v->id, 'actor_id' => $actor->user->id, 'on_hand_delta' => $data['on_hand_delta'], 'reserved_delta' => 0, 'reason' => $data['reason'], 'effect_key' => 'adjust:'.Str::uuid()]);
            Audit::write($actor, 'inventory.adjusted', 'variant', $id);

            return $b;
        }, 3);
    }
}
