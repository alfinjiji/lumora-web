<?php

namespace App\Modules\Catalog\Actions;

use App\Modules\Catalog\Models\Collection;
use App\Modules\Catalog\Models\Product;
use App\Modules\Catalog\Models\Variant;
use App\Support\Actor;
use App\Support\ApiError;
use App\Support\Audit;
use App\Support\Version;
use Illuminate\Support\Facades\DB;

final class SaveProduct
{
    public function execute(array $data, Actor $actor, ?string $id = null): Product
    {
        $actor->owner();

        return DB::transaction(function () use ($data, $actor, $id) {
            $p = $id ? Product::where('public_id', $id)->lockForUpdate()->firstOrFail() : new Product(['scent_notes' => [], 'status' => 'draft']);
            if ($id) {
                Version::check($p, $data['expected_version']);
            }
            $p->fill(array_intersect_key($data, array_flip(['title', 'slug', 'description', 'scent_notes', 'status'])));
            if ($p->status === 'active') {
                ApiError::ensure($p->exists && strlen(trim($p->description)) > 0 && Variant::where('product_id', $p->id)->where('active', true)->exists() && DB::table('product_media')->join('media', 'media.id', '=', 'product_media.media_id')->where('product_id', $p->id)->where('media.status', 'ready')->exists(), 'CATALOGUE_INCOMPLETE', 'Add a description, ready product photo and active variant before publishing.', 422);
            }
            if ($id) {
                $p->version++;
            }$p->save();
            if (array_key_exists('collection_ids', $data)) {
                $ids = Collection::whereIn('public_id', $data['collection_ids'])->pluck('id');
                ApiError::ensure($ids->count() === count(array_unique($data['collection_ids'])), 'VALIDATION_ERROR', 'Unknown collection.', 422);
                DB::table('collection_product')->where('product_id', $p->id)->delete();
                foreach ($ids as $cid) {
                    DB::table('collection_product')->insert(['collection_id' => $cid, 'product_id' => $p->id]);
                }
            }
            Audit::write($actor, $id ? 'product.updated' : 'product.created', 'product', $p->public_id);

            return $p;
        }, 3);
    }
}
