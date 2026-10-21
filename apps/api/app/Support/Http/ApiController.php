<?php

namespace App\Support\Http;

use App\Support\Actor;
use App\Support\Idempotency;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

abstract class ApiController
{
    protected function ok(array $data, int $status = 200): JsonResponse
    {
        return response()->json(['data' => (new ApiResource($data))->resolve(request())], $status);
    }

    protected function ack(int $status = 200): JsonResponse
    {
        return $this->ok(['message' => 'Request received.'], $status);
    }

    protected function listing($query, callable $project): JsonResponse
    {
        $p = $query->paginate(min(100, max(1, (int) request('per_page', 20))));

        return response()->json(['data' => array_map($project, $p->items()), 'meta' => ['page' => $p->currentPage(), 'per_page' => $p->perPage(), 'total' => $p->total()], 'links' => ['next' => $p->nextPageUrl(), 'prev' => $p->previousPageUrl()]]);
    }

    protected function command(Request $request, callable $work, int $status = 200): JsonResponse
    {
        $actor = Actor::request();
        $scope = ($actor->user?->public_id ?? $actor->sessionId).'|'.$request->method().'|'.$request->path();

        return response()->json(app(Idempotency::class)->execute($scope, $request->header('Idempotency-Key', ''), $request->all(), fn () => ['data' => $work()]), $status);
    }
}
