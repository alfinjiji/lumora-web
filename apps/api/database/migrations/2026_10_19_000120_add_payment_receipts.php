<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_receipts', function ($t) {
            $t->id();
            $t->ulid('public_id')->unique();
            $t->foreignId('attempt_id')->constrained('payment_attempts')->restrictOnDelete();
            $t->string('external_id')->unique();
            $t->unsignedBigInteger('amount_minor');
            $t->string('disposition', 20);
            $t->timestamp('received_at');
            $t->timestamps();
        });
        Schema::table('refunds', function ($t) {
            $t->foreignId('receipt_id')->nullable()->unique()->constrained('payment_receipts')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        throw new LogicException('Receipt history is permanent.');
    }
};
