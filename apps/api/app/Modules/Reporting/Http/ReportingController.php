<?php

namespace App\Modules\Reporting\Http;

use App\Models\User;
use App\Modules\Reporting\Jobs\GenerateOrderExport;
use App\Modules\Reporting\Models\Export;
use App\Modules\Reporting\Queries\DashboardQuery;
use App\Support\Actor;
use App\Support\ApiError;
use App\Support\Audit;
use App\Support\ContractRequest;
use App\Support\Http\ApiController;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;

final class ReportingController extends ApiController
{
    public function overview(Request $r, DashboardQuery $q)
    {
        $d = $r->validate(['from' => 'sometimes|date', 'to' => 'sometimes|date']);

        return $this->ok($q->execute(Actor::request(), $d['from'] ?? null, $d['to'] ?? null));
    }

    public function audit()
    {
        return $this->listing(DB::table('audit_logs')->orderByDesc('id'), fn ($a) => ['id' => $a->public_id, 'actor_id' => $a->actor_id ? User::find($a->actor_id)?->public_id : null, 'action' => $a->action, 'entity_type' => $a->entity_type, 'entity_id' => $a->entity_id, 'created_at' => Carbon::parse($a->created_at)->toISOString()]);
    }

    public static function project(Export $e): array
    {
        return ['id' => $e->public_id, 'status' => $e->status, 'download_url' => $e->status === 'ready' && $e->expires_at->isFuture() ? URL::temporarySignedRoute('export-download', now()->addMinutes(5), ['exportId' => $e->public_id]) : null, 'expires_at' => $e->expires_at?->toISOString()];
    }

    public function createExport(ContractRequest $r)
    {
        $d = $r->validated();
        $from = Carbon::parse($d['from']);
        $to = Carbon::parse($d['to']);
        ApiError::ensure($from->lte($to) && $from->diffInDays($to) <= 366, 'VALIDATION_ERROR', 'Limit exports to 366 ordered days.', 422);
        $e = Export::create(['requester_id' => auth()->id(), 'filters' => $d, 'status' => 'queued']);
        GenerateOrderExport::dispatch($e->id);
        Audit::write(Actor::request(), 'export.requested', 'export', $e->public_id);

        return $this->ok(self::project($e), 202);
    }

    public function exportShow(string $exportId)
    {
        return $this->ok(self::project(Export::where('public_id', $exportId)->where('requester_id', auth()->id())->firstOrFail()));
    }

    public function download(Request $r, string $exportId)
    {
        ApiError::ensure($r->hasValidSignature(), 'FORBIDDEN', 'Download link expired.', 403);
        $e = Export::where('public_id', $exportId)->where('requester_id', auth()->id())->where('status', 'ready')->where('expires_at', '>', now())->firstOrFail();

        return Storage::disk('local')->download($e->key, 'auraflare-orders.csv', ['Cache-Control' => 'private, no-store']);
    }
}
