<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $t) {
            $t->ulid('public_id')->unique();
            $t->boolean('active')->default(true);
            $t->string('phone')->nullable();
            $t->text('bio')->nullable();
            $t->unsignedBigInteger('avatar_media_id')->nullable();
            $t->unsignedInteger('version')->default(1);
        });
        $create = function (string $name, callable $columns) {
            Schema::create($name, function (Blueprint $t) use ($columns) {
                $t->id();
                $t->ulid('public_id')->unique();
                $columns($t);
                $t->timestamps();
            });
        };
        $create('staff_memberships', function ($t) {
            $t->foreignId('user_id')->unique()->constrained('users')->restrictOnDelete();
            $t->string('role', 20);
            $t->boolean('active')->default(true);
            $t->unsignedInteger('version')->default(1);
        });
        Schema::create('identity_locks', function ($t) {
            $t->string('name')->primary();
        });
        DB::table('identity_locks')->insert(['name' => 'owners']);
        $create('invitations', function ($t) {
            $t->string('email');
            $t->string('name');
            $t->string('role', 20);
            $t->char('token_hash', 64)->unique();
            $t->timestamp('expires_at');
            $t->timestamp('accepted_at')->nullable();
            $t->timestamp('revoked_at')->nullable();
            $t->foreignId('invited_by')->nullable()->constrained('users')->restrictOnDelete();
        });
        $create('access_tokens', function ($t) {
            $t->string('purpose', 40);
            $t->string('email');
            $t->char('token_hash', 64)->unique();
            $t->json('payload')->nullable();
            $t->timestamp('expires_at');
            $t->timestamp('used_at')->nullable();
        });
        $create('customer_addresses', function ($t) {
            $t->foreignId('user_id')->constrained()->restrictOnDelete();
            $t->string('line1');
            $t->string('line2')->default('');
            $t->string('city');
            $t->char('state_code', 2);
            $t->char('postcode', 6);
            $t->char('country_code', 2)->default('IN');
        });
        $create('media', function ($t) {
            $t->foreignId('owner_id')->nullable()->constrained('users')->restrictOnDelete();
            $t->unsignedBigInteger('order_id')->nullable();
            $t->char('guest_session_hash', 64)->nullable();
            $t->string('purpose', 40);
            $t->string('disk', 30);
            $t->string('key')->unique();
            $t->string('mime', 100);
            $t->unsignedBigInteger('bytes');
            $t->string('status', 20);
            $t->string('scan_status', 20)->nullable();
            $t->timestamp('attached_at')->nullable();
        });
        Schema::table('users', fn ($t) => $t->foreign('avatar_media_id')->references('id')->on('media')->restrictOnDelete());
        $create('products', function ($t) {
            $t->string('slug')->unique();
            $t->string('title');
            $t->text('description');
            $t->json('scent_notes');
            $t->string('status', 20)->index();
            $t->unsignedInteger('version')->default(1);
        });
        $create('product_variants', function ($t) {
            $t->foreignId('product_id')->constrained('products')->restrictOnDelete();
            $t->string('sku', 100)->unique();
            $t->json('options');
            $t->char('options_hash', 64);
            $t->unsignedBigInteger('price_minor');
            $t->char('currency', 3)->default('INR');
            $t->boolean('active');
            $t->unsignedInteger('version')->default(1);
            $t->unique(['product_id', 'options_hash']);
        });
        $create('collections', function ($t) {
            $t->string('slug')->unique();
            $t->string('title');
            $t->string('status', 20);
            $t->unsignedInteger('version')->default(1);
        });
        Schema::create('collection_product', function ($t) {
            $t->foreignId('collection_id')->constrained()->restrictOnDelete();
            $t->foreignId('product_id')->constrained()->restrictOnDelete();
            $t->unsignedInteger('position')->default(0);
            $t->primary(['collection_id', 'product_id']);
        });
        Schema::create('product_media', function ($t) {
            $t->foreignId('product_id')->constrained()->restrictOnDelete();
            $t->foreignId('media_id')->constrained('media')->restrictOnDelete();
            $t->unsignedInteger('position')->default(0);
            $t->string('alt')->default('');
            $t->primary(['product_id', 'media_id']);
        });
        $create('inventory_balances', function ($t) {
            $t->foreignId('variant_id')->unique()->constrained('product_variants')->restrictOnDelete();
            $t->unsignedInteger('on_hand')->default(0);
            $t->unsignedInteger('reserved')->default(0);
            $t->unsignedInteger('low_stock_threshold')->default(10);
            $t->unsignedInteger('version')->default(1);
        });
        DB::statement('ALTER TABLE inventory_balances ADD CONSTRAINT valid_inventory CHECK (reserved <= on_hand)');
        $create('delivery_rules', function ($t) {
            $t->string('kind', 20);
            $t->char('state_code', 2);
            $t->string('city')->nullable();
            $t->char('postcode', 6)->nullable();
            $t->boolean('allow');
            $t->boolean('active');
            $t->integer('priority')->default(0);
            $t->unsignedInteger('version')->default(1);
        });
        $create('carts', function ($t) {
            $t->foreignId('user_id')->nullable()->constrained()->restrictOnDelete();
            $t->char('session_hash', 64)->nullable()->index();
            $t->unsignedInteger('version')->default(1);
            $t->timestamp('submitted_at')->nullable();
        });
        $create('cart_items', function ($t) {
            $t->foreignId('cart_id')->constrained()->cascadeOnDelete();
            $t->foreignId('variant_id')->constrained('product_variants')->restrictOnDelete();
            $t->unsignedInteger('quantity');
            $t->unsignedBigInteger('unit_price_minor');
            $t->unique(['cart_id', 'variant_id']);
        });
        $create('orders', function ($t) {
            $t->string('number')->unique();
            $t->foreignId('user_id')->nullable()->constrained()->restrictOnDelete();
            $t->string('source', 20);
            $t->json('contact');
            $t->json('address');
            $t->text('customer_note')->nullable();
            $t->json('policy_snapshot');
            $t->string('status', 40)->index();
            $t->string('payment_status', 30)->default('unpaid')->index();
            $t->string('fulfillment_status', 30)->default('unfulfilled');
            $t->char('currency', 3)->default('INR');
            $t->unsignedBigInteger('subtotal_minor');
            $t->unsignedBigInteger('tax_minor');
            $t->unsignedBigInteger('shipping_minor')->nullable();
            $t->unsignedBigInteger('total_minor')->nullable();
            $t->unsignedInteger('version')->default(1);
            $t->unsignedBigInteger('current_quote_id')->nullable();
            $t->timestamp('paid_at')->nullable();
            $t->boolean('restocked')->default(false);
        });
        $create('order_items', function ($t) {
            $t->foreignId('order_id')->constrained()->restrictOnDelete();
            $t->foreignId('variant_id')->constrained('product_variants')->restrictOnDelete();
            $t->string('sku');
            $t->string('title');
            $t->json('options');
            $t->unsignedInteger('quantity');
            $t->unsignedBigInteger('unit_price_minor');
            $t->unsignedBigInteger('line_total_minor');
        });
        $create('shipping_quotes', function ($t) {
            $t->foreignId('order_id')->constrained()->restrictOnDelete();
            $t->unsignedInteger('version');
            $t->unsignedBigInteger('amount_minor');
            $t->unsignedBigInteger('total_minor');
            $t->string('status', 20)->default('current');
            $t->timestamp('expires_at');
            $t->timestamp('accepted_at')->nullable();
            $t->foreignId('issued_by')->constrained('users')->restrictOnDelete();
            $t->text('note')->nullable();
            $t->unique(['order_id', 'version']);
        });
        Schema::table('orders', fn ($t) => $t->foreign('current_quote_id')->references('id')->on('shipping_quotes')->restrictOnDelete());
        $create('stock_reservations', function ($t) {
            $t->foreignId('order_id')->unique()->constrained()->restrictOnDelete();
            $t->string('status', 20);
            $t->timestamp('expires_at')->index();
        });
        Schema::create('reservation_items', function ($t) {
            $t->foreignId('reservation_id')->constrained('stock_reservations')->restrictOnDelete();
            $t->foreignId('variant_id')->constrained('product_variants')->restrictOnDelete();
            $t->unsignedInteger('quantity');
            $t->primary(['reservation_id', 'variant_id']);
        });
        $create('inventory_movements', function ($t) {
            $t->foreignId('variant_id')->constrained('product_variants')->restrictOnDelete();
            $t->foreignId('order_id')->nullable()->constrained()->restrictOnDelete();
            $t->foreignId('actor_id')->nullable()->constrained('users')->restrictOnDelete();
            $t->integer('on_hand_delta');
            $t->integer('reserved_delta');
            $t->text('reason');
            $t->string('effect_key')->unique();
        });
        $create('guest_grants', function ($t) {
            $t->char('session_hash', 64)->index();
            $t->foreignId('order_id')->constrained()->restrictOnDelete();
            $t->timestamp('expires_at');
            $t->timestamp('revoked_at')->nullable();
            $t->unique(['session_hash', 'order_id']);
        });
        $create('payment_attempts', function ($t) {
            $t->foreignId('order_id')->constrained()->restrictOnDelete();
            $t->foreignId('quote_id')->constrained('shipping_quotes')->restrictOnDelete();
            $t->string('method', 20);
            $t->string('status', 30)->index();
            $t->unsignedBigInteger('amount_minor');
            $t->char('currency', 3)->default('INR');
            $t->string('provider_order_id')->nullable()->unique();
            $t->string('provider_payment_id')->nullable()->unique();
            $t->string('receipt')->unique();
            $t->json('provider_facts')->nullable();
            $t->string('failure_code')->nullable();
            $t->timestamp('settled_at')->nullable();
        });
        $create('manual_payment_evidence', function ($t) {
            $t->foreignId('attempt_id')->unique()->constrained('payment_attempts')->restrictOnDelete();
            $t->text('reference');
            $t->foreignId('media_id')->nullable()->constrained('media')->restrictOnDelete();
            $t->string('status', 20);
            $t->string('bank_reference')->nullable()->unique();
            $t->timestamp('submitted_at');
            $t->foreignId('reviewed_by')->nullable()->constrained('users')->restrictOnDelete();
            $t->timestamp('reviewed_at')->nullable();
            $t->text('review_reason')->nullable();
        });
        $create('refunds', function ($t) {
            $t->foreignId('attempt_id')->constrained('payment_attempts')->restrictOnDelete();
            $t->unsignedBigInteger('amount_minor');
            $t->string('status', 20);
            $t->string('provider_ref')->nullable()->unique();
            $t->string('bank_reference')->nullable()->unique();
            $t->text('reason');
            $t->unsignedInteger('version')->default(1);
            $t->timestamp('refunded_at')->nullable();
        });
        $create('webhook_events', function ($t) {
            $t->string('provider', 20);
            $t->string('event_id');
            $t->char('payload_hash', 64);
            $t->json('payload');
            $t->string('status', 20);
            $t->unsignedInteger('attempts')->default(0);
            $t->timestamp('processed_at')->nullable();
            $t->unique(['provider', 'event_id']);
        });
        $create('shipments', function ($t) {
            $t->foreignId('order_id')->unique()->constrained()->restrictOnDelete();
            $t->string('carrier');
            $t->string('tracking_number');
            $t->text('tracking_url')->nullable();
            $t->timestamp('shipped_at');
            $t->timestamp('delivered_at')->nullable();
        });
        $create('content_revisions', function ($t) {
            $t->unsignedInteger('version')->unique();
            $t->string('status', 20);
            $t->json('hero');
            $t->text('announcement');
            $t->foreignId('featured_collection_id')->nullable()->constrained('collections')->restrictOnDelete();
        });
        Schema::create('content_pointers', function ($t) {
            $t->string('page')->primary();
            $t->foreignId('revision_id')->nullable()->constrained('content_revisions')->restrictOnDelete();
        });
        DB::table('content_pointers')->insert(['page' => 'home', 'revision_id' => null]);
        $create('enquiries', function ($t) {
            $t->json('contact');
            $t->string('source', 20);
            $t->text('message');
            $t->foreignId('product_id')->nullable()->constrained('products')->restrictOnDelete();
            $t->date('event_date')->nullable();
            $t->unsignedInteger('quantity')->nullable();
            $t->string('status', 20)->default('new');
            $t->foreignId('assigned_to')->nullable()->constrained('users')->restrictOnDelete();
            $t->unsignedInteger('version')->default(1);
        });
        $create('enquiry_notes', function ($t) {
            $t->foreignId('enquiry_id')->constrained('enquiries')->restrictOnDelete();
            $t->foreignId('actor_id')->constrained('users')->restrictOnDelete();
            $t->text('body');
        });
        $create('export_jobs', function ($t) {
            $t->foreignId('requester_id')->constrained('users')->restrictOnDelete();
            $t->json('filters');
            $t->string('status', 20);
            $t->string('key')->nullable();
            $t->timestamp('expires_at')->nullable();
        });
        Schema::create('audit_logs', function ($t) {
            $t->id();
            $t->ulid('public_id')->unique();
            $t->foreignId('actor_id')->nullable()->constrained('users')->restrictOnDelete();
            $t->string('action');
            $t->string('entity_type');
            $t->string('entity_id');
            $t->string('request_id')->nullable();
            $t->timestamp('created_at');
        });
        Schema::create('idempotency_records', function ($t) {
            $t->id();
            $t->string('scope');
            $t->string('key', 128);
            $t->char('payload_hash', 64);
            $t->json('response')->nullable();
            $t->timestamp('created_at');
            $t->timestamp('expires_at');
            $t->unique(['scope', 'key']);
        });
        Schema::create('outbox_messages', function ($t) {
            $t->id();
            $t->ulid('public_id')->unique();
            $t->string('effect_key')->unique();
            $t->string('type', 40);
            $t->json('payload');
            $t->string('status', 20);
            $t->unsignedInteger('attempts')->default(0);
            $t->timestamp('delivered_at')->nullable();
            $t->timestamps();
        });
        Schema::create('notification_deliveries', function ($t) {
            $t->id();
            $t->foreignId('outbox_id')->unique()->constrained('outbox_messages')->restrictOnDelete();
            $t->timestamp('sent_at');
        });
    }

    public function down(): void
    {
        throw new LogicException('Use a reviewed forward migration or restore a backup; commerce history must not be dropped.');
    }
};
