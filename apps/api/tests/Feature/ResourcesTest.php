<?php

namespace Tests\Feature;

use App\Modules\Catalog\Actions\SaveProduct;
use App\Modules\Commerce\Queries\OrderQuery;
use App\Modules\Content\Actions\ManageHomeContent;
use App\Modules\Enquiries\Models\Enquiry;
use App\Modules\Media\Models\Media;
use App\Support\Actor;
use App\Support\ApiError;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\Support\StudioFixtures;
use Tests\TestCase;

final class ResourcesTest extends TestCase
{
    use RefreshDatabase,StudioFixtures;

    private function snapshot(string $schema, array $data): void
    {
        $path = storage_path('framework/testing/contracts');
        if (! is_dir($path)) {
            mkdir($path, 0700, true);
        }file_put_contents($path.'/'.$schema.'.json', json_encode($data, JSON_THROW_ON_ERROR));
    }

    public function test_runtime_resource_projections_are_recorded_for_full_contract_validation(): void
    {
        $this->configureCommerce();
        $v = $this->variant();
        $owner = $this->person('owner');
        $this->snapshot('ProductListResponse', $this->getJson('/api/v1/products')->assertOk()->json());
        $this->snapshot('UserResponse', $this->actingAs($owner)->getJson('/api/v1/me')->assertOk()->json());
        $this->snapshot('InventoryListResponse', $this->getJson('/api/v1/admin/inventory')->assertOk()->json());
        $o = $this->order($v, new Actor($owner, 'owner'));
        $this->snapshot('OrderResponse', ['data' => app(OrderQuery::class)->project($o, new Actor($owner, 'owner'))]);
        $this->snapshot('AdminOrderResponse', $this->getJson('/api/v1/admin/orders/'.$o->public_id)->assertOk()->json());
        $this->snapshot('DashboardResponse', $this->getJson('/api/v1/admin/overview')->assertOk()->json());
        $this->snapshot('CartResponse', $this->getJson('/api/v1/cart')->assertOk()->json());
        $this->snapshot('RuleListResponse', $this->getJson('/api/v1/admin/delivery-rules')->assertOk()->json());
        $this->snapshot('AssigneeListResponse', $this->getJson('/api/v1/admin/assignees')->assertOk()->json());
    }

    public function test_empty_variant_options_are_valid_and_unknown_input_fields_are_rejected(): void
    {
        $u = $this->person('owner');
        $p = app(SaveProduct::class)->execute(['title' => 'Fixture', 'slug' => 'fixture-empty-options', 'description' => 'Synthetic fixture', 'status' => 'draft'], new Actor($u, 'owner'));
        $this->actingAs($u)->postJson('/api/v1/admin/products/'.$p->public_id.'/variants', ['sku' => 'SYNTHETIC-EMPTY', 'options' => [], 'price_minor' => 34950, 'active' => true])->assertCreated()->assertJsonPath('data.version', 1);
        $this->postJson('/api/v1/admin/products/'.$p->public_id.'/variants', ['sku' => 'SYNTHETIC-WRONG', 'options' => [], 'price_minor' => '34950', 'active' => true])->assertStatus(422);
    }

    public function test_active_products_require_real_fields_ready_media_and_active_variants(): void
    {
        $u = $this->person('owner');
        $a = new Actor($u, 'owner');
        $p = app(SaveProduct::class)->execute(['title' => 'Fixture', 'slug' => 'fixture-publish', 'description' => 'Synthetic fixture', 'status' => 'draft'], $a);
        $this->expectException(ApiError::class);
        app(SaveProduct::class)->execute(['expected_version' => 1, 'status' => 'active'], $a, $p->public_id);
    }

    public function test_media_decoding_ownership_avatar_and_quarantine_are_enforced(): void
    {
        $u = $this->person('owner');
        $this->actingAs($u);
        Storage::fake('local');
        Storage::fake('public');
        $valid = $this->post('/api/v1/media', ['file' => UploadedFile::fake()->image('fixture.png', 400, 400), 'purpose' => 'avatar'], ['Accept' => 'application/json'])->assertCreated();
        $id = $valid->json('data.id');
        $m = Media::where('public_id', $id)->firstOrFail();
        $bytes = Storage::disk('local')->get($m->key);
        $this->assertSame('image/webp', (new \finfo(FILEINFO_MIME_TYPE))->buffer($bytes));
        $this->assertLessThanOrEqual(256, getimagesizefromstring($bytes)[0]);
        $this->putJson('/api/v1/me/avatar', ['media_id' => $id])->assertOk();
        $other = $this->person();
        $this->actingAs($other)->putJson('/api/v1/me/avatar', ['media_id' => $id])->assertForbidden();
        $this->post('/api/v1/media', ['file' => UploadedFile::fake()->createWithContent('fake.png', '<?php echo "not an image";'), 'purpose' => 'avatar'], ['Accept' => 'application/json'])->assertStatus(422);
    }

    public function test_content_drafts_do_not_publish_and_long_copy_survives_publication(): void
    {
        $u = $this->person('owner');
        $a = new Actor($u, 'owner');
        $c = app(ManageHomeContent::class);
        $data = ['expected_version' => 1, 'hero' => ['heading' => str_repeat('Longcopy', 20), 'subtitle' => str_repeat('A little warmth ', 100), 'image_media_id' => null, 'cta_label' => 'Explore the collection', 'cta_path' => '/#collection'], 'announcement' => '', 'featured_collection_id' => null];
        $draft = $c->save($data, $a);
        $this->assertNull(DB::table('content_pointers')->value('revision_id'));
        $c->publish(['expected_version' => $draft->version], $a);
        $this->snapshot('ContentResponse', $this->getJson('/api/v1/content/home')->assertOk()->json());
        $next = $c->save(array_replace($data, ['hero' => array_replace($data['hero'], ['heading' => 'New private draft'])]), $a);
        $this->assertSame($data['hero']['heading'], $c->current(true)->hero['heading']);
    }

    public function test_staff_order_projection_excludes_payment_evidence_and_provider_data(): void
    {
        $this->configureCommerce();
        $v = $this->variant();
        $o = $this->order($v);
        $staff = $this->person('fulfillment');
        $data = app(OrderQuery::class)->project($o, new Actor($staff, 'staff'), true);
        $this->assertSame([], $data['payment_attempts']);
        $this->assertSame([], $data['manual_evidence']);
        $this->assertArrayNotHasKey('payment_receipts', $data);
        $this->assertArrayNotHasKey('contact', app(OrderQuery::class)->project($o, new Actor(null, 'guest-fixture')));
    }

    public function test_enquiries_persist_internal_notes_without_returning_them_publicly(): void
    {
        $r = $this->postJson('/api/v1/enquiries', ['contact' => $this->contact(), 'source' => 'event', 'message' => 'Synthetic event enquiry'])->assertCreated();
        $this->assertSame(['message' => 'Request received.'], $r->json('data'));
        $u = $this->person('fulfillment');
        $this->actingAs($u);
        $e = Enquiry::first();
        $this->postJson('/api/v1/admin/enquiries/'.$e->public_id.'/notes', ['body' => 'Private synthetic follow-up'])->assertCreated();
        $this->getJson('/api/v1/admin/enquiries/'.$e->public_id)->assertOk()->assertJsonMissing(['body' => 'Private synthetic follow-up']);
        $this->snapshot('EnquiryResponse', $this->getJson('/api/v1/admin/enquiries/'.$e->public_id)->json());
    }
}
