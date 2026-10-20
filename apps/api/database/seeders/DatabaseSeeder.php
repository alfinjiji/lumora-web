<?php

namespace Database\Seeders;

use App\Modules\Delivery\Models\Rule;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        Rule::firstOrCreate(['kind' => 'state', 'state_code' => 'KL', 'city' => null, 'postcode' => null], ['allow' => true, 'active' => true, 'priority' => 0]);
    }
}
