<?php

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$files = array_merge(glob(app_path('Modules/*/Models/*.php')), [app_path('Models/User.php')]);
foreach ($files as $file) {
    $src = file_get_contents($file);
    preg_match('/namespace ([^;]+);/', $src, $ns);
    preg_match('/class (\w+) extends/', $src, $class);
    $name = $ns[1].'\\'.$class[1];
    $model = new $name;
    $table = $model->getTable();
    $casts = $model->getCasts();
    $doc = "/**\n";
    foreach (DB::select('SHOW COLUMNS FROM `'.$table.'`') as $c) {
        $type = match (true) {
            isset($casts[$c->Field]) && str_starts_with($casts[$c->Field], 'immutable_datetime') => '\\Carbon\\CarbonImmutable',isset($casts[$c->Field]) && (str_starts_with($casts[$c->Field], 'date') || str_starts_with($casts[$c->Field], 'datetime')) => '\\Illuminate\\Support\\Carbon',in_array($c->Field, ['created_at', 'updated_at']) => '\\Illuminate\\Support\\Carbon',($casts[$c->Field] ?? null) === 'boolean' => 'bool',str_contains($c->Type, 'int') => 'int',($casts[$c->Field] ?? null) === 'array' => 'array',default => 'string'
        };
        $doc .= ' * @property '.$type.($c->Null === 'YES' ? '|null' : '').' $'.$c->Field."\n";
    }
    $doc .= " */\n";
    $src = preg_replace('/\/\*\*.*?\*\/\s*(?=class)/s', '', $src);
    $src = preg_replace('/\bclass '.$class[1].' extends/', $doc.'class '.$class[1].' extends', $src);
    file_put_contents($file, $src);
}
echo 'Domain model annotations synchronized with the migrated MySQL columns.'.PHP_EOL;
