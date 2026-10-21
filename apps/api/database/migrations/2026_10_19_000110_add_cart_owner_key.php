<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('carts', fn (Blueprint $t) => $t->string('owner_key')->nullable()->unique());
    }

    public function down(): void
    {
        Schema::table('carts', fn (Blueprint $t) => $t->dropColumn('owner_key'));
    }
};
