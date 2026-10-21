<?php

namespace App\Modules\Payments\Actions;

use App\Modules\Inventory\Actions\LockOrderStock;
use App\Modules\Payments\Models\Attempt;
use App\Modules\Payments\Models\Evidence;
use App\Support\Actor;
use App\Support\ApiError;
use App\Support\Audit;
use App\Support\Version;
use Carbon\Carbon;

final class ReviewManualPayment
{
    public function execute(Evidence $e, array $d, Actor $a, bool $approve): mixed
    {
        $a->owner();
        $attempt = Attempt::findOrFail($e->attempt_id);

        return app(LockOrderStock::class)->execute($attempt->order_id, function ($o, $r) use ($e, $attempt, $d, $a, $approve) {
            $a->owner();
            Version::check($o, $d['expected_version']);
            $e = Evidence::whereKey($e->id)->lockForUpdate()->firstOrFail();
            ApiError::ensure($e->status === 'under_review', 'INVALID_TRANSITION', 'This evidence was already reviewed.');
            if ($approve) {
                ApiError::ensure($d['received_amount_minor'] === $attempt->amount_minor && Carbon::parse($d['received_at'])->lte(now()->addMinutes(5)), 'PAYMENT_MISMATCH', 'Verify the exact received amount and date.', 422);
                $ref = strtoupper(preg_replace('/\s+/', '', trim($d['bank_reference'])));
                ApiError::ensure($ref !== '', 'VALIDATION_ERROR', 'Enter the independently verified bank reference.', 422);
                $e->update(['status' => 'approved', 'bank_reference' => $ref, 'reviewed_by' => $a->user->id, 'reviewed_at' => now(), 'review_reason' => $d['note'] ?? null]);
                app(SettleOrderPayment::class)->execute($attempt, ['id' => $ref, 'order_id' => $attempt->provider_order_id, 'amount' => $attempt->amount_minor, 'currency' => 'INR', 'status' => 'captured'], $a, Carbon::parse($d['received_at']));
            } else {
                $e->update(['status' => 'rejected', 'reviewed_by' => $a->user->id, 'reviewed_at' => now(), 'review_reason' => $d['reason']]);
                $attempt->update(['status' => 'rejected']);
                $o->update(['status' => $r->expires_at->isFuture() ? 'awaiting_payment' : 'expired', 'payment_status' => 'unpaid', 'version' => $o->version + 1]);
            }
            Audit::write($a, $approve ? 'manual_payment.approved' : 'manual_payment.rejected', 'order', $o->public_id);

            return $o->refresh();
        });
    }
}
