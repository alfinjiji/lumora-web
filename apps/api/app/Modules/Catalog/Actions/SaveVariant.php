<?php

namespace App\Modules\Catalog\Actions;

use App\Modules\Catalog\Models\Product;
use App\Modules\Catalog\Models\Variant;
use App\Modules\Inventory\Models\Balance;
use App\Support\Actor;
use App\Support\ApiError;
use App\Support\Audit;
use App\Support\Version;
use Illuminate\Support\Facades\DB;

final class SaveVariant
{
    public function execute(array $data, Actor $actor, ?string $productId = null, ?string $id = null): Variant
    {
        $actor->owner();

        return DB::transaction(function () use ($data, $actor, $productId, $id) {
            $v = $id ? Variant::where('public_id', $id)->lockForUpdate()->firstOrFail() : new Variant(['product_id' => Product::where('public_id', $productId)->firstOrFail()->id]);
            if ($id) {
                Version::check($v, $data['expected_version']);
            }
            $v->fill(array_intersect_key($data, array_flip(['sku', 'options', 'price_minor', 'active'])));
            $v->sku = strtoupper(trim($v->sku));
            $options = $v->options;
            usort($options, fn ($a, $b) => strcmp(strtolower($a['name']), strtolower($b['name'])));
            $names = array_map(fn ($x) => strtolower(trim($x['name'])), $options);
            ApiError::ensure(count($names) === count(array_unique($names)), 'VALIDATION_ERROR', 'Option names must be unique.', 422);
            $v->options_hash = hash('sha256', json_encode(array_map(fn ($o) => [strtolower(trim($o['name'])), strtolower(trim($o['value']))], $options)));
            if ($id) {
                $v->version++;
            }$v->save();
            if (! $id) {
                Balance::create(['variant_id' => $v->id]);
            }Audit::write($actor, $id ? 'variant.updated' : 'variant.created', 'variant', $v->public_id);

            return $v;
        }, 3);
    }
}
