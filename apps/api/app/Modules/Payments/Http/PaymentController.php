<?php

namespace App\Modules\Payments\Http;

use App\Modules\Commerce\Actions\OrderAccess;
use App\Modules\Commerce\Models\Order;
use App\Modules\Commerce\Models\Quote;
use App\Modules\Commerce\Queries\OrderQuery;
use App\Modules\Inventory\Actions\LockOrderStock;
use App\Modules\Inventory\Models\Movement;
use App\Modules\Media\Models\Media;
use App\Modules\Payments\Actions\CreateRazorpayAttempt;
use App\Modules\Payments\Actions\ReconcilePayment;
use App\Modules\Payments\Actions\RequestRefund;
use App\Modules\Payments\Actions\ReviewManualPayment;
use App\Modules\Payments\Actions\SubmitManualEvidence;
use App\Modules\Payments\Actions\VerifyCheckoutPayment;
use App\Modules\Payments\Jobs\ProcessWebhook;
use App\Modules\Payments\Models\Attempt;
use App\Modules\Payments\Models\Evidence;
use App\Modules\Payments\Models\Refund;
use App\Modules\Payments\Models\WebhookEvent;
use App\Modules\Payments\Queries\PaymentQuery;
use App\Support\Actor;
use App\Support\ApiError;
use App\Support\Audit;
use App\Support\ContractRequest;
use App\Support\Http\ApiController;
use App\Support\Idempotency;
use App\Support\Version;
use Carbon\Carbon;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\URL;

final class PaymentController extends ApiController
{
    public function create(ContractRequest $r, string $orderId)
    {
        $o = app(OrderAccess::class)->execute($orderId, Actor::request());
        $p = app(CreateRazorpayAttempt::class)->execute($o, $r->validated(), Actor::request(), $r->header('Idempotency-Key', ''));

        return $this->ok(PaymentQuery::attempt($p), in_array($p->status, ['created', 'unknown']) ? 202 : 201);
    }

    public function verify(ContractRequest $r, string $orderId, string $attemptId)
    {
        $o = app(OrderAccess::class)->execute($orderId, Actor::request());
        $p = Attempt::where('public_id', $attemptId)->where('order_id', $o->id)->firstOrFail();

        return $this->ok(PaymentQuery::attempt(app(VerifyCheckoutPayment::class)->execute($p, $r->validated(), Actor::request())));
    }

    public function instructions(string $orderId)
    {
        $o = app(OrderAccess::class)->execute($orderId, Actor::request());
        $instructions = config('auraflare.manual_instructions');
        ApiError::ensure($instructions && config('auraflare.manual_payee_name') && config('auraflare.manual_destination'), 'PAYMENTS_UNAVAILABLE', 'Manual payment is not configured.', 503);
        $q = Quote::find($o->current_quote_id);
        ApiError::ensure($q && $q->expires_at->isFuture(), 'QUOTE_REQUIRED', 'A current quote is required.');

        return $this->ok(['instructions' => $instructions, 'payee_name' => config('auraflare.manual_payee_name'), 'payment_destination' => config('auraflare.manual_destination'), 'quote_id' => $q->public_id, 'amount_minor' => $q->total_minor, 'currency' => 'INR']);
    }

    public function submitEvidence(ContractRequest $r, string $orderId)
    {
        $o = app(OrderAccess::class)->execute($orderId, Actor::request());

        return $this->command($r, fn () => PaymentQuery::evidence(app(SubmitManualEvidence::class)->execute($o, $r->validated(), Actor::request())), 201);
    }

    public function evidence()
    {
        return $this->listing(Evidence::orderByDesc('id'), fn ($e) => PaymentQuery::evidence($e));
    }

    public function review(ContractRequest $r, string $evidenceId, OrderQuery $q)
    {
        return $this->command($r, fn () => $q->project(app(ReviewManualPayment::class)->execute(Evidence::where('public_id', $evidenceId)->firstOrFail(), $r->validated(), Actor::request(), str_ends_with($r->path(), '/approve')), Actor::request(), true));
    }

    public function download(string $evidenceId)
    {
        $e = Evidence::where('public_id', $evidenceId)->firstOrFail();
        $m = Media::findOrFail($e->media_id);
        ApiError::ensure($m->status === 'ready' && $m->scan_status === 'clean', 'MEDIA_NOT_READY', 'Evidence must pass scanning first.');
        $expires = now()->addMinutes(5);

        return $this->ok(['url' => URL::temporarySignedRoute('private-media', $expires, ['mediaId' => $m->public_id]), 'expires_at' => $expires->toISOString()]);
    }

    public function refund(ContractRequest $r, string $orderId)
    {
        $a = Actor::request();
        $scope = $a->user->public_id.'|refund|'.$orderId;
        $result = app(Idempotency::class)->execute($scope, $r->header('Idempotency-Key', ''), $r->validated(), fn () => ['id' => app(RequestRefund::class)->create(Order::where('public_id', $orderId)->firstOrFail(), $r->validated(), $a)->id]);
        $refund = app(RequestRefund::class)->send(Refund::findOrFail($result['id']));

        return $this->ok(PaymentQuery::refund($refund), 202);
    }

    public function refundShow(string $refundId)
    {
        return $this->ok(PaymentQuery::refund(Refund::where('public_id', $refundId)->firstOrFail()));
    }

    public function manualRefund(ContractRequest $r, string $refundId)
    {
        return $this->command($r, function () use ($r, $refundId) {
            $d = $r->validated();
            $refund = DB::transaction(function () use ($d, $refundId) {
                $reference = Refund::where('public_id', $refundId)->firstOrFail();
                $p = Attempt::findOrFail($reference->attempt_id);
                $order = Order::whereKey($p->order_id)->lockForUpdate()->firstOrFail();
                Actor::request()->owner();
                $rf = Refund::whereKey($reference->id)->lockForUpdate()->firstOrFail();
                Version::check($rf, $d['expected_version']);
                $p = Attempt::findOrFail($rf->attempt_id);
                ApiError::ensure($p->method === 'manual' && $rf->status === 'requested', 'INVALID_TRANSITION', 'This manual refund cannot be confirmed.');
                ApiError::ensure(Carbon::parse($d['refunded_at'])->lte(now()->addMinutes(5)), 'VALIDATION_ERROR', 'A refund date cannot be in the future.', 422);
                $rf->update(['status' => 'succeeded', 'bank_reference' => strtoupper(preg_replace('/\s+/', '', $d['bank_reference'])), 'refunded_at' => Carbon::parse($d['refunded_at']), 'version' => $rf->version + 1]);
                $order->update(['payment_status' => RequestRefund::paymentState($order), 'version' => $order->version + 1]);
                Audit::write(Actor::request(), 'refund.manual_confirmed', 'refund', $rf->public_id);

                return $rf;
            });

            return PaymentQuery::refund($refund);
        });
    }

    public function reconcile(ContractRequest $r, string $orderId, OrderQuery $q)
    {
        $o = Order::where('public_id', $orderId)->firstOrFail();
        Version::check($o, $r->validated()['expected_version']);
        foreach (Attempt::where('order_id', $o->id)->where('method', 'razorpay')->get() as $p) {
            app(ReconcilePayment::class)->execute($p);
        }

        return $this->ok($q->project($o->refresh(), Actor::request(), true), 202);
    }

    public function webhook(Request $r)
    {
        $raw = $r->getContent();
        $secret = config('auraflare.razorpay.webhook_secret');
        ApiError::ensure($secret && hash_equals(hash_hmac('sha256', $raw, $secret), $r->header('X-Razorpay-Signature', '')), 'INVALID_SIGNATURE', 'Invalid webhook signature.', 400);
        $id = $r->header('X-Razorpay-Event-Id');
        ApiError::ensure(is_string($id) && strlen($id) > 0 && strlen($id) < 200, 'INVALID_EVENT', 'Missing event ID.', 400);
        $payload = json_decode($raw, true);
        ApiError::ensure(is_array($payload), 'INVALID_EVENT', 'Invalid JSON.', 400);
        try {
            $e = WebhookEvent::firstOrCreate(['provider' => 'razorpay', 'event_id' => $id], ['payload_hash' => hash('sha256', $raw), 'payload' => $payload, 'status' => 'pending']);
            ApiError::ensure(hash_equals($e->payload_hash, hash('sha256', $raw)), 'INVALID_EVENT', 'Event content changed.', 400);
        } catch (QueryException) {
            throw new ApiError('DEPENDENCY_UNAVAILABLE', 'Please retry webhook delivery.', 503);
        }try {
            ProcessWebhook::dispatch($e->id);
        } catch (\Throwable) {/* Durable inbox remains available to the sweeper. */
        }

        return $this->ack();
    }

    public function restock(ContractRequest $r, string $orderId, OrderQuery $q)
    {
        return $this->command($r, function () use ($r, $orderId, $q) {
            $d = $r->validated();
            $order = Order::where('public_id', $orderId)->firstOrFail();
            $o = app(LockOrderStock::class)->execute($order->id, function ($o, $hold, $balances) use ($d) {
                Version::check($o, $d['expected_version']);
                ApiError::ensure($o->status === 'cancelled' && $hold->status === 'consumed' && ! $o->restocked && ! in_array($o->fulfillment_status, ['shipped', 'delivered']), 'INVALID_TRANSITION', 'Only a cancelled, consumed, unshipped order can be restocked once.');
                foreach (DB::table('reservation_items')->where('reservation_id', $hold->id)->get() as $item) {
                    $b = $balances[$item->variant_id];
                    $b->update(['on_hand' => $b->on_hand + $item->quantity, 'version' => $b->version + 1]);
                    Movement::create(['variant_id' => $item->variant_id, 'order_id' => $o->id, 'actor_id' => auth()->id(), 'on_hand_delta' => $item->quantity, 'reserved_delta' => 0, 'reason' => $d['reason'], 'effect_key' => $hold->public_id.':restock:'.$item->variant_id]);
                }$o->update(['restocked' => true, 'version' => $o->version + 1]);
                Audit::write(Actor::request(), 'order.restocked', 'order', $o->public_id);

                return $o;
            });

            return $q->project($o, Actor::request(), true);
        });
    }
}
