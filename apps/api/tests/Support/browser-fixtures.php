<?php

use App\Models\User;
use App\Modules\Catalog\Models\Collection;
use App\Modules\Catalog\Models\Product;
use App\Modules\Catalog\Models\Variant;
use App\Modules\Content\Models\Revision;
use App\Modules\Identity\Models\StaffMembership;
use App\Modules\Inventory\Models\Balance;
use App\Modules\Media\Models\Media;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
if (! app()->environment('testing') || config('database.connections.mysql.database') !== 'auraflare_browser') {
    throw new RuntimeException('Browser fixtures require the isolated auraflare_browser database.');
}
Artisan::call('migrate:fresh', ['--force' => true]);
Artisan::call('db:seed', ['--force' => true]);
$password = bin2hex(random_bytes(16));
$accounts = [];
foreach (['owner', 'fulfillment', 'customer'] as $role) {
    $email = $role.'@example.test';
    $u = User::create(['name' => ucfirst($role).' Fixture', 'email' => $email, 'password' => $password, 'email_verified_at' => now()]);
    if ($role !== 'customer') {
        StaffMembership::create(['user_id' => $u->id, 'role' => $role, 'active' => true]);
    }$accounts[$role] = ['email' => $email, 'password' => $password, 'id' => $u->public_id];
    if ($role === 'owner') {
        $owner = $u;
    }
}
$collections = [];
foreach (['Home', 'Gifting', 'Sculptural'] as $title) {
    $collections[] = Collection::create(['title' => $title, 'slug' => strtolower($title), 'status' => 'active']);
}
foreach (['jar', 'pillars', 'bubble', 'violet', 'hearts', 'lotus', 'glass', 'tealights'] as $i => $image) {
    $p = Product::create(['title' => 'Sample '.ucfirst($image).' Candle', 'slug' => 'sample-'.$image, 'description' => 'Synthetic development fixture only. This is not a real catalogue item or a product available for purchase.', 'scent_notes' => ['Sample fragrance'], 'status' => 'active']);
    $v = Variant::create(['product_id' => $p->id, 'sku' => 'SYNTHETIC-'.strtoupper($image), 'options' => [['name' => 'Colour', 'value' => 'Sample ivory']], 'options_hash' => hash('sha256', 'sample-ivory'), 'price_minor' => 34950 + $i * 10000, 'active' => true]);
    Balance::create(['variant_id' => $v->id, 'on_hand' => 10]);
    $key = 'product_image/fixture-'.$image.'.webp';
    Storage::disk('public')->put($key, file_get_contents('/fixtures/'.$image.'.webp'));
    $m = Media::create(['owner_id' => $owner->id, 'purpose' => 'product_image', 'disk' => 'public', 'key' => $key, 'mime' => 'image/webp', 'bytes' => Storage::disk('public')->size($key), 'status' => 'ready', 'attached_at' => now()]);
    DB::table('product_media')->insert(['product_id' => $p->id, 'media_id' => $m->id, 'position' => 0, 'alt' => $p->title]);
    foreach ($collections as $c) {
        DB::table('collection_product')->insert(['product_id' => $p->id, 'collection_id' => $c->id]);
    }
}
$r = Revision::create(['version' => 1, 'status' => 'published', 'hero' => ['heading' => 'A little light. A slower moment.', 'subtitle' => 'Synthetic development catalogue. No real products, orders or payments.', 'image_media_id' => null, 'cta_label' => 'Find your glow', 'cta_path' => '/#collection'], 'announcement' => 'DEVELOPMENT FIXTURES · NOT A LIVE STORE', 'featured_collection_id' => $collections[0]->id]);
DB::table('content_pointers')->where('page', 'home')->update(['revision_id' => $r->id]);
$accountsPath = getenv('BROWSER_ACCOUNTS_PATH') ?: '/tmp/browser-accounts.json';
file_put_contents($accountsPath, json_encode($accounts));
chmod($accountsPath, 0600);
echo "Synthetic browser database prepared.\n";
