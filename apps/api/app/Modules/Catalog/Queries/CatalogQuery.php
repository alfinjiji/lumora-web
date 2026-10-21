<?php

namespace App\Modules\Catalog\Queries;

use App\Modules\Catalog\Models\Collection;
use App\Modules\Catalog\Models\Product;
use App\Modules\Catalog\Models\Variant;
use App\Modules\Inventory\Models\Balance;
use App\Modules\Media\Actions\UploadMedia;
use App\Modules\Media\Models\Media;
use Illuminate\Support\Facades\DB;

final class CatalogQuery
{
    public function products(bool $admin = false)
    {
        $q = Product::query();
        if (! $admin) {
            $q->where('status', 'active');
        }
        if ($search = request('q')) {
            $q->where('title', 'like', '%'.mb_substr($search, 0, 100).'%');
        }
        if ($collection = request('collection')) {
            $q->whereIn('id', DB::table('collection_product')->join('collections', 'collections.id', '=', 'collection_product.collection_id')->where('collections.slug', $collection)->select('product_id'));
        }

        return match (request('sort', 'featured')) {
            'price_asc' => $q->orderByRaw('(select min(price_minor) from product_variants where product_id=products.id and active=1) asc')->orderBy('id'),'price_desc' => $q->orderByRaw('(select min(price_minor) from product_variants where product_id=products.id and active=1) desc')->orderBy('id'),'newest' => $q->orderByDesc('id'),default => $q->orderBy('id')
        };
    }

    public function variant(Variant $v): array
    {
        $b = Balance::where('variant_id', $v->id)->firstOrFail();

        return ['id' => $v->public_id, 'sku' => $v->sku, 'options' => $v->options, 'price_minor' => $v->price_minor, 'currency' => 'INR', 'active' => $v->active, 'available_quantity' => $b->on_hand - $b->reserved, 'version' => $v->version];
    }

    public function product(Product $p, bool $admin = false): array
    {
        $variants = Variant::where('product_id', $p->id);
        if (! $admin) {
            $variants->where('active', true);
        }

        return ['id' => $p->public_id, 'title' => $p->title, 'slug' => $p->slug, 'description' => $p->description, 'scent_notes' => $p->scent_notes, 'status' => $p->status, 'collection_ids' => Collection::whereIn('id', DB::table('collection_product')->where('product_id', $p->id)->select('collection_id'))->pluck('public_id')->all(), 'variants' => $variants->get()->map(fn ($v) => $this->variant($v))->all(), 'images' => Media::whereIn('id', DB::table('product_media')->where('product_id', $p->id)->orderBy('position')->select('media_id'))->where('status', 'ready')->get()->map(fn ($m) => UploadMedia::project($m))->all(), 'version' => $p->version];
    }

    public function collection(Collection $c, bool $admin = false): array
    {
        $q = Product::whereIn('id', DB::table('collection_product')->where('collection_id', $c->id)->select('product_id'));
        if (! $admin) {
            $q->where('status', 'active');
        }

        return ['id' => $c->public_id, 'title' => $c->title, 'slug' => $c->slug, 'status' => $c->status, 'product_ids' => $q->pluck('public_id')->all(), 'version' => $c->version];
    }
}
