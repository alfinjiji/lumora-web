<?php

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Storage;

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
// This explicit local emulator uses synthetic credentials and is never a production service.
config(['filesystems.disks.s3.key' => 'synthetic-local-only', 'filesystems.disks.s3.secret' => 'synthetic-local-only', 'filesystems.disks.s3.region' => 'ap-south-1', 'filesystems.disks.s3.bucket' => 'auraflare-test', 'filesystems.disks.s3.endpoint' => 'http://s3-emulator:5000', 'filesystems.disks.s3.use_path_style_endpoint' => true]);
try {
    $disk = Storage::disk('s3');
    $disk->getClient()->createBucket(['Bucket' => 'auraflare-test', 'CreateBucketConfiguration' => ['LocationConstraint' => 'ap-south-1']]);
    if (! $disk->put('qualification/probe.txt', 'synthetic-storage-probe') || $disk->get('qualification/probe.txt') !== 'synthetic-storage-probe' || ! $disk->delete('qualification/probe.txt')) {
        throw new RuntimeException('Storage round trip failed.');
    }
    echo "S3-compatible storage write/read/delete passed against the private local emulator.\n";
} catch (Throwable $e) {
    fwrite(STDERR, 'Storage emulator qualification failed: '.get_class($e)."\n");
    exit(1);
}
