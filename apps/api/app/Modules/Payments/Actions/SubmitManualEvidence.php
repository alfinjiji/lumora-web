<?php

namespace App\Modules\Payments\Actions;

use App\Modules\Commerce\Models\Order;
use App\Modules\Inventory\Actions\LockOrderStock;
use App\Modules\Media\Models\Media;
use App\Modules\Payments\Models\Attempt;
use App\Modules\Payments\Models\Evidence;
use App\Support\Actor;
use App\Support\ApiError;
use App\Support\Audit;

final class SubmitManualEvidence
{
    public function execute(Order $order, array $d, Actor $a): Evidence
    {
        ApiError::ensure(config('auraflare.manual_instructions') && config('auraflare.manual_payee_name') && config('auraflare.manual_destination'), 'PAYMENTS_UNAVAILABLE', 'Manual payment instructions are not configured.', 503);

        return app(LockOrderStock::class)->execute($order->id, function ($o, $r) use ($d, $a) {
            $q = app(AcceptQuote::class)->execute($o, $r, $d);
            ApiError::ensure(! Attempt::where('order_id', $o->id)->whereIn('status', ['created', 'pending', 'unknown', 'authorized', 'under_review'])->lockForUpdate()->first(), 'PAYMENT_IN_PROGRESS', 'Resolve the current payment first.');
            $media = null;
            if (! empty($d['media_id'])) {
                $media = Media::where('public_id', $d['media_id'])->firstOrFail();
                ApiError::ensure($media->order_id === $o->id && $media->purpose === 'manual_payment_proof' && (($a->user && $media->owner_id === $a->user->id) || $media->guest_session_hash === hash('sha256', $a->sessionId)), 'FORBIDDEN', 'This proof is not available to this order.', 403);
                ApiError::ensure($media->status === 'ready' && $media->scan_status === 'clean', 'MEDIA_NOT_READY', 'The proof is not ready for review.');
            }
            $p = Attempt::create(['order_id' => $o->id, 'quote_id' => $q->id, 'method' => 'manual', 'status' => 'under_review', 'amount_minor' => $q->total_minor, 'receipt' => 'MAN'.bin2hex(random_bytes(14))]);
            $e = Evidence::create(['attempt_id' => $p->id, 'reference' => $d['reference'], 'media_id' => $media?->id, 'status' => 'under_review', 'submitted_at' => now()]);
            if ($media) {
                $media->update(['attached_at' => now()]);
            }$r->update(['expires_at' => now()->addHours(config('auraflare.manual_hours'))]);
            $o->update(['status' => 'payment_review', 'payment_status' => 'under_review', 'version' => $o->version + 1]);
            Audit::write($a, 'manual_payment.submitted', 'order', $o->public_id);

            return $e;
        });
    }
}
