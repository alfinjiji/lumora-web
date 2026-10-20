<?php

namespace App\Modules\Media\Actions;

use App\Modules\Media\Models\Media;
use Illuminate\Support\Facades\Storage;

final class RescanProofs
{
    public function execute(): int
    {
        $count = 0;
        foreach (Media::where('purpose', 'manual_payment_proof')->where('status', 'processing')->orderBy('id')->limit(100)->get() as $media) {
            $status = app(ScanProof::class)->status(Storage::disk($media->disk)->get($media->key));
            if ($status === 'infected') {
                $media->update(['status' => 'rejected', 'scan_status' => 'infected']);
            }
            if ($status === 'clean') {
                $media->update(['status' => 'ready', 'scan_status' => 'clean']);
                $count++;
            }
        }

        return $count;
    }
}
