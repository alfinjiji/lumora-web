<?php

namespace App\Modules\Content\Actions;

use App\Modules\Catalog\Models\Collection;
use App\Modules\Content\Models\Revision;
use App\Modules\Media\Models\Media;
use App\Support\Actor;
use App\Support\ApiError;
use App\Support\Audit;
use App\Support\Version;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

final class ManageHomeContent
{
    public function current(bool $public = false): Revision
    {
        if ($public) {
            $id = DB::table('content_pointers')->where('page', 'home')->value('revision_id');

            return Revision::findOrFail($id);
        }

        return Revision::orderByDesc('version')->firstOrFail();
    }

    public function save(array $d, Actor $a): Revision
    {
        $a->owner();

        return DB::transaction(function () use ($d, $a) {
            DB::table('content_pointers')->where('page', 'home')->lockForUpdate()->first();
            $last = Revision::orderByDesc('version')->lockForUpdate()->first();
            ApiError::ensure(($last?->version ?? 1) === $d['expected_version'], 'VERSION_CONFLICT', 'Content changed; reload before saving.');
            $image = $d['hero']['image_media_id'];
            if ($image) {
                $m = Media::where('public_id', $image)->firstOrFail();
                ApiError::ensure($m->purpose === 'content_image' && $m->status === 'ready' && ($m->owner_id === $a->user->id || $m->attached_at), 'MEDIA_NOT_READY', 'Use a ready campaign image.');
                $m->update(['attached_at' => now()]);
            }$collection = null;
            if ($d['featured_collection_id']) {
                $collection = Collection::where('public_id', $d['featured_collection_id'])->where('status', 'active')->firstOrFail();
            }
            ApiError::ensure(str_starts_with($d['hero']['cta_path'], '/') && ! str_starts_with($d['hero']['cta_path'], '//') && ! str_contains($d['hero']['cta_path'], chr(92)) && ! preg_match('/[\x00-\x20]/', $d['hero']['cta_path']), 'VALIDATION_ERROR', 'Use a local website path.', 422);
            $rev = Revision::create(['version' => ($last?->version ?? 0) + 1, 'status' => 'draft', 'hero' => $d['hero'], 'announcement' => $d['announcement'], 'featured_collection_id' => $collection?->id]);
            Audit::write($a, 'content.draft_saved', 'content', $rev->public_id);

            return $rev;
        }, 3);
    }

    public function publish(array $d, Actor $a): Revision
    {
        $a->owner();

        return DB::transaction(function () use ($d, $a) {
            DB::table('content_pointers')->where('page', 'home')->lockForUpdate()->first();
            $r = Revision::orderByDesc('version')->lockForUpdate()->firstOrFail();
            Version::check($r, $d['expected_version']);
            $r->update(['status' => 'published']);
            DB::table('content_pointers')->where('page', 'home')->update(['revision_id' => $r->id]);
            DB::afterCommit(fn () => Cache::forget('public-home'));
            Audit::write($a, 'content.published', 'content', $r->public_id);

            return $r;
        }, 3);
    }

    public static function project(Revision $r): array
    {
        return ['id' => $r->public_id, 'version' => $r->version, 'status' => $r->status, 'hero' => $r->hero, 'announcement' => $r->announcement, 'featured_collection_id' => $r->featured_collection_id ? Collection::findOrFail($r->featured_collection_id)->public_id : null];
    }
}
