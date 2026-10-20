<?php

namespace App\Modules\Payments\Actions;

use App\Modules\Payments\Contracts\RazorpayGateway;
use App\Modules\Payments\Models\Attempt;
use App\Support\Actor;
use App\Support\ApiError;

final class VerifyCheckoutPayment
{
    public function execute(Attempt $p, array $d, Actor $a): Attempt
    {
        ApiError::ensure($p->provider_order_id && $p->provider_order_id === $d['razorpay_order_id'], 'PAYMENT_MISMATCH', 'Payment order does not match.', 422);
        $secret = config('auraflare.razorpay.key_secret');
        ApiError::ensure((bool) $secret, 'PAYMENTS_UNAVAILABLE', 'Payment verification is not configured.', 503);
        $signature = hash_hmac('sha256', $p->provider_order_id.'|'.$d['razorpay_payment_id'], $secret);
        ApiError::ensure(hash_equals($signature, $d['razorpay_signature']), 'INVALID_SIGNATURE', 'Payment signature is invalid.', 422);
        $facts = app(RazorpayGateway::class)->payment($d['razorpay_payment_id']);
        if (($facts['status'] ?? null) === 'authorized') {
            ApiError::ensure($facts['order_id'] === $p->provider_order_id && $facts['amount'] === $p->amount_minor && $facts['currency'] === 'INR', 'PAYMENT_MISMATCH', 'Payment does not match.', 422);
            if (! $p->settled_at) {
                $p->update(['status' => 'authorized']);
            }

            return $p;
        }

        return app(SettleOrderPayment::class)->execute($p, $facts, $a);
    }
}
