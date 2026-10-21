<?php

namespace App\Modules\Media\Actions;

use App\Modules\Commerce\Actions\OrderAccess;
use App\Modules\Media\Models\Media;
use App\Support\Actor;
use App\Support\ApiError;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

final class UploadMedia
{
    public function execute(UploadedFile $file, string $purpose, ?string $orderId, Actor $actor): Media
    {
        ApiError::ensure(in_array($purpose, ['avatar', 'product_image', 'content_image', 'manual_payment_proof']), 'VALIDATION_ERROR', 'Invalid upload purpose.', 422);
        if (in_array($purpose, ['product_image', 'content_image'])) {
            $actor->owner();
        }
        if ($purpose === 'avatar') {
            ApiError::ensure((bool) $actor->user, 'UNAUTHENTICATED', 'Sign in first.', 401);
        }
        ApiError::ensure($purpose === 'manual_payment_proof' || ! $orderId, 'VALIDATION_ERROR', 'An order is only valid for a payment proof.', 422);
        $order = $purpose === 'manual_payment_proof' ? app(OrderAccess::class)->execute($orderId ?? '', $actor) : null;
        $max = $purpose === 'avatar' ? 2 : ($purpose === 'manual_payment_proof' ? 5 : 10);
        ApiError::ensure($file->isValid() && $file->getSize() <= $max * 1024 * 1024, 'VALIDATION_ERROR', 'Upload exceeds the allowed size.', 422);
        $bytes = file_get_contents($file->getRealPath());
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->buffer($bytes);
        $proof = $purpose === 'manual_payment_proof';
        $ready = true;
        $scanStatus = null;
        if ($mime === 'application/pdf') {
            ApiError::ensure($proof && str_starts_with($bytes, '%PDF-'), 'VALIDATION_ERROR', 'PDF is only supported for payment evidence.', 422);
        } else {
            ApiError::ensure(in_array($mime, ['image/jpeg', 'image/png', 'image/webp']), 'VALIDATION_ERROR', 'Choose a genuine JPEG, PNG or WebP image.', 422);
            $size = @getimagesizefromstring($bytes);
            ApiError::ensure($size && $size[0] * $size[1] <= 20000000, 'VALIDATION_ERROR', 'Image dimensions are too large.', 422);
            $image = @imagecreatefromstring($bytes);
            ApiError::ensure((bool) $image, 'VALIDATION_ERROR', 'Cannot decode this image.', 422);
            $limit = $purpose === 'avatar' ? 256 : 1800;
            $scale = min(1, $limit / max($size[0], $size[1]));
            $target = imagecreatetruecolor(max(1, (int) ($size[0] * $scale)), max(1, (int) ($size[1] * $scale)));
            imagealphablending($target, false);
            imagesavealpha($target, true);
            imagecopyresampled($target, $image, 0, 0, 0, 0, imagesx($target), imagesy($target), $size[0], $size[1]);
            ob_start();
            imagewebp($target, null, 86);
            $bytes = ob_get_clean();
            $mime = 'image/webp';
        }
        if ($proof) {
            $scanStatus = app(ScanProof::class)->status($bytes);
            $ready = $scanStatus === 'clean';
        }
        $disk = in_array($purpose, ['product_image', 'content_image']) ? config('auraflare.media_public_disk', 'public') : config('auraflare.media_private_disk', 'local');
        $key = $purpose.'/'.Str::uuid().($mime === 'application/pdf' ? '.pdf' : '.webp');
        ApiError::ensure(Storage::disk($disk)->put($key, $bytes), 'STORAGE_UNAVAILABLE', 'The upload could not be stored. Try again later.', 503);

        return Media::create(['owner_id' => $actor->user?->id, 'order_id' => $order?->id, 'guest_session_hash' => hash('sha256', $actor->sessionId), 'purpose' => $purpose, 'disk' => $disk, 'key' => $key, 'mime' => $mime, 'bytes' => strlen($bytes), 'status' => $scanStatus === 'infected' ? 'rejected' : ($ready ? 'ready' : 'processing'), 'scan_status' => $scanStatus]);
    }

    public function authorizeAttach(Media $m, Actor $actor, string $purpose): void
    {
        ApiError::ensure($m->status === 'ready' && $m->purpose === $purpose, 'MEDIA_NOT_READY', 'Choose a ready image of the correct purpose.');
        ApiError::ensure($m->owner_id === $actor->user?->id, 'FORBIDDEN', 'You cannot attach this upload.', 403);
    }

    public static function project(Media $m): array
    {
        return ['id' => $m->public_id, 'purpose' => $m->purpose, 'status' => $m->status, 'url' => in_array($m->purpose, ['product_image', 'content_image']) && $m->status === 'ready' ? url('/media/'.$m->public_id) : null];
    }
}
