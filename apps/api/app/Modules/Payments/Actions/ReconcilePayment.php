<?php

namespace App\Modules\Payments\Actions;

use App\Modules\Payments\Contracts\RazorpayGateway;
use App\Modules\Payments\Models\Attempt;
use App\Support\ApiError;

final class ReconcilePayment
{
    public function execute(Attempt $p): Attempt
    {
        if ($p->method !== 'razorpay') {
            return $p;
        }
        $gateway = app(RazorpayGateway::class);
        if (! $p->provider_order_id) {
            $orders = $gateway->ordersByReceipt($p->receipt);
            if (count($orders) !== 1) {
                return $p;
            }$match = $orders[0];
            ApiError::ensure($match['amount'] === $p->amount_minor && $match['currency'] === 'INR', 'PAYMENT_MISMATCH', 'Reconciliation amount mismatch.', 422);
            $p->update(['provider_order_id' => $match['id'], 'status' => 'pending']);
        }
        app(ObserveProviderPayments::class)->execute($p, $gateway->paymentsForOrder($p->provider_order_id));

        return $p->refresh();
    }
}
