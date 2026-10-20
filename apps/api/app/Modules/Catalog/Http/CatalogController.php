<?php

namespace App\Modules\Catalog\Http;

use App\Modules\Catalog\Actions\SaveProduct;
use App\Modules\Catalog\Actions\SaveVariant;
use App\Modules\Catalog\Models\Collection;
use App\Modules\Catalog\Models\Product;
use App\Modules\Catalog\Queries\CatalogQuery;
use App\Modules\Media\Actions\UploadMedia;
use App\Modules\Media\Models\Media;
use App\Support\Actor;
use App\Support\ApiError;
use App\Support\Audit;
use App\Support\ContractRequest;
use App\Support\Http\ApiController;
use App\Support\Version;
use Illuminate\Support\Facades\DB;

final class CatalogController extends ApiController
{
    private function admin(): bool
    {
        return str_contains(request()->path(), '/admin/');
    }

    public function products(CatalogQuery $q)
    {
        return $this->listing($q->products($this->admin()), fn ($p) => $q->product($p, $this->admin()));
    }

    public function product(string $slug, CatalogQuery $q)
    {
        return $this->ok($q->product(Product::where('slug', $slug)->where('status', 'active')->firstOrFail()));
    }

    public function adminProduct(string $productId, CatalogQuery $q)
    {
        return $this->ok($q->product(Product::where('public_id', $productId)->firstOrFail(), true));
    }

    public function productSave(ContractRequest $r, CatalogQuery $q, ?string $productId = null)
    {
        return $this->ok($q->product(app(SaveProduct::class)->execute($r->validated(), Actor::request(), $productId), true), $productId ? 200 : 201);
    }

    public function variantCreate(ContractRequest $r, string $productId, CatalogQuery $q)
    {
        return $this->ok($q->variant(app(SaveVariant::class)->execute($r->validated(), Actor::request(), $productId)), 201);
    }

    public function variantUpdate(ContractRequest $r, string $variantId, CatalogQuery $q)
    {
        return $this->ok($q->variant(app(SaveVariant::class)->execute($r->validated(), Actor::request(), null, $variantId)));
    }

    public function collections(CatalogQuery $q)
    {
        $list = Collection::orderBy('id');
        if (! $this->admin()) {
            $list->where('status', 'active');
        }

        return $this->listing($list, fn ($c) => $q->collection($c, $this->admin()));
    }

    public function collection(string $slug, CatalogQuery $q)
    {
        return $this->ok($q->collection(Collection::where('slug', $slug)->where('status', 'active')->firstOrFail()));
    }

    public function collectionSave(ContractRequest $r, CatalogQuery $q, ?string $collectionId = null)
    {
        $d = $r->validated();
        $c = DB::transaction(function () use ($d, $collectionId) {
            $c = $collectionId ? Collection::where('public_id', $collectionId)->lockForUpdate()->firstOrFail() : new Collection;
            if ($collectionId) {
                Version::check($c, $d['expected_version']);
            }$c->fill(array_intersect_key($d, array_flip(['title', 'slug', 'status'])));
            if ($collectionId) {
                $c->version++;
            }$c->save();
            if (isset($d['product_ids'])) {
                $ids = Product::whereIn('public_id', $d['product_ids'])->pluck('id');
                ApiError::ensure($ids->count() === count(array_unique($d['product_ids'])), 'VALIDATION_ERROR', 'Unknown product.', 422);
                DB::table('collection_product')->where('collection_id', $c->id)->delete();
                foreach ($ids as $id) {
                    DB::table('collection_product')->insert(['collection_id' => $c->id, 'product_id' => $id]);
                }
            }Audit::write(Actor::request(), 'collection.saved', 'collection', $c->public_id);

            return $c;
        });

        return $this->ok($q->collection($c, true), $collectionId ? 200 : 201);
    }

    public function image(ContractRequest $r, string $productId, CatalogQuery $q, ?string $mediaId = null)
    {
        $d = $r->validated();
        $p = DB::transaction(function () use ($r, $productId, $mediaId, $d) {
            $p = Product::where('public_id', $productId)->lockForUpdate()->firstOrFail();
            Version::check($p, $d['expected_version']);
            $m = Media::where('public_id', $mediaId ?? $d['media_id'])->firstOrFail();
            if ($r->isMethod('delete')) {
                ApiError::ensure($p->status !== 'active' || DB::table('product_media')->where('product_id', $p->id)->count() > 1, 'CATALOGUE_INCOMPLETE', 'An active product needs a photo.');
                DB::table('product_media')->where('product_id', $p->id)->where('media_id', $m->id)->delete();
            } else {
                app(UploadMedia::class)->authorizeAttach($m, Actor::request(), 'product_image');
                DB::table('product_media')->updateOrInsert(['product_id' => $p->id, 'media_id' => $m->id], ['alt' => $d['alt'], 'position' => $d['sort_order']]);
                $m->update(['attached_at' => now()]);
            }$p->update(['version' => $p->version + 1]);

            return $p;
        });

        return $this->ok($q->product($p, true));
    }
}
