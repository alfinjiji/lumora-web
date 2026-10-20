<?php

namespace App\Modules\Inventory\Http;

use App\Modules\Catalog\Models\Variant;
use App\Modules\Inventory\Actions\AdjustInventory;
use App\Modules\Inventory\Models\Balance;
use App\Modules\Inventory\Models\Movement;
use App\Support\Actor;
use App\Support\ContractRequest;
use App\Support\Http\ApiController;
use App\Support\Version;
use Illuminate\Support\Facades\DB;

final class InventoryController extends ApiController
{
    public static function project(Balance $b): array
    {
        $v = Variant::findOrFail($b->variant_id);

        return ['variant_id' => $v->public_id, 'sku' => $v->sku, 'on_hand' => $b->on_hand, 'reserved' => $b->reserved, 'available' => $b->on_hand - $b->reserved, 'low_stock_threshold' => $b->low_stock_threshold, 'version' => $b->version];
    }

    public function index()
    {
        return $this->listing(Balance::orderBy('id'), fn ($b) => self::project($b));
    }

    public function adjust(ContractRequest $r, string $variantId)
    {
        return $this->command($r, fn () => self::project(app(AdjustInventory::class)->execute($variantId, $r->validated(), Actor::request())));
    }

    public function threshold(ContractRequest $r, string $variantId)
    {
        $d = $r->validated();
        $b = DB::transaction(function () use ($d, $variantId) {
            $b = Balance::where('variant_id', Variant::where('public_id', $variantId)->firstOrFail()->id)->lockForUpdate()->firstOrFail();
            Version::check($b, $d['expected_version']);
            $b->update(['low_stock_threshold' => $d['low_stock_threshold'], 'version' => $b->version + 1]);

            return $b;
        });

        return $this->ok(self::project($b));
    }

    public function movements(string $variantId)
    {
        $v = Variant::where('public_id', $variantId)->firstOrFail();

        return $this->listing(Movement::where('variant_id', $v->id)->orderByDesc('id'), fn ($m) => ['id' => $m->public_id, 'variant_id' => $variantId, 'on_hand_delta' => $m->on_hand_delta, 'reserved_delta' => $m->reserved_delta, 'reason' => $m->reason, 'created_at' => $m->created_at->toISOString()]);
    }
}
