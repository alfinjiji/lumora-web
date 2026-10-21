<?php

namespace App\Modules\Media\Http;

use App\Models\User;
use App\Modules\Commerce\Actions\OrderAccess;
use App\Modules\Commerce\Models\Order;
use App\Modules\Identity\Http\IdentityController;
use App\Modules\Media\Actions\UploadMedia;
use App\Modules\Media\Models\Media;
use App\Support\Actor;
use App\Support\ApiError;
use App\Support\ContractRequest;
use App\Support\Http\ApiController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

final class MediaController extends ApiController
{
    public function upload(Request $r)
    {
        $d = $r->validate(['file' => 'required|file|max:10240', 'purpose' => 'required|string', 'order_id' => 'sometimes|ulid']);

        return $this->ok(UploadMedia::project(app(UploadMedia::class)->execute($r->file('file'), $d['purpose'], $d['order_id'] ?? null, Actor::request())), 201);
    }

    public function show(string $mediaId)
    {
        $m = Media::where('public_id', $mediaId)->firstOrFail();
        $a = Actor::request();
        if ($m->purpose === 'manual_payment_proof') {
            app(OrderAccess::class)->execute(Order::findOrFail($m->order_id)->public_id, $a);
        } else {
            ApiError::ensure($m->owner_id === $a->user?->id && $a->user, 'FORBIDDEN', 'This upload is private.', 403);
        }

        return $this->ok(UploadMedia::project($m));
    }

    public function avatar(ContractRequest $r)
    {
        $m = Media::where('public_id', $r->validated()['media_id'])->firstOrFail();
        app(UploadMedia::class)->authorizeAttach($m, Actor::request(), 'avatar');
        $r->user()->update(['avatar_media_id' => $m->id, 'version' => $r->user()->version + 1]);
        $m->update(['attached_at' => now()]);

        return $this->ok(IdentityController::user($r->user()));
    }

    public function removeAvatar(Request $r)
    {
        $r->user()->update(['avatar_media_id' => null, 'version' => $r->user()->version + 1]);

        return $this->ok(IdentityController::user($r->user()));
    }

    public function avatarFile(string $userId)
    {
        $u = User::where('public_id', $userId)->firstOrFail();
        $actor = Actor::request();
        ApiError::ensure($actor->user && ($actor->user->id === $u->id || $actor->role()), 'FORBIDDEN', 'This photo is private.', 403);

        return $this->file(Media::findOrFail($u->avatar_media_id));
    }

    public function publicFile(string $mediaId)
    {
        $m = Media::where('public_id', $mediaId)->whereIn('purpose', ['product_image', 'content_image'])->where('status', 'ready')->firstOrFail();
        $live = DB::table('product_media')->join('products', 'products.id', '=', 'product_media.product_id')->where('media_id', $m->id)->where('products.status', 'active')->exists();
        $content = DB::table('content_pointers')->join('content_revisions', 'content_revisions.id', '=', 'content_pointers.revision_id')->first();
        $live = $live || ($content && ((json_decode($content->hero, true)['image_media_id'] ?? null) === $m->public_id));
        ApiError::ensure($live || Actor::request()->role() === 'owner', 'NOT_FOUND', 'Media not found.', 404);

        return $this->file($m);
    }

    public function privateFile(Request $r, string $mediaId)
    {
        Actor::request()->owner();
        ApiError::ensure($r->hasValidSignature(), 'FORBIDDEN', 'This link expired.', 403);
        $m = Media::where('public_id', $mediaId)->where('purpose', 'manual_payment_proof')->where('status', 'ready')->where('scan_status', 'clean')->firstOrFail();

        return $this->file($m, true);
    }

    private function file(Media $m, bool $download = false)
    {
        $response = $download ? Storage::disk($m->disk)->download($m->key, 'payment-evidence.'.($m->mime === 'application/pdf' ? 'pdf' : 'webp')) : Storage::disk($m->disk)->response($m->key);
        $response->headers->set('Cache-Control', 'private, no-store');
        $response->headers->set('Content-Security-Policy', "sandbox; default-src 'none'");

        return $response;
    }
}
