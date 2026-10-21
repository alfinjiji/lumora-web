<?php

namespace App\Modules\Payments\Adapters;

use App\Modules\Payments\Contracts\RazorpayGateway;
use App\Support\ApiError;
use Illuminate\Support\Facades\Http;

final class RazorpayHttpGateway implements RazorpayGateway
{
    private function request()
    {
        ApiError::ensure(in_array(config('auraflare.razorpay.mode'), ['test', 'live']) && config('auraflare.razorpay.key_id') && config('auraflare.razorpay.key_secret'), 'PAYMENTS_UNAVAILABLE', 'Online payments are not configured.', 503);
        $expected = config('auraflare.razorpay.mode') === 'live' ? 'rzp_live_' : 'rzp_test_';
        ApiError::ensure(str_starts_with(config('auraflare.razorpay.key_id'), $expected), 'PAYMENTS_UNAVAILABLE', 'Payment mode and keys do not match.', 503);

        return Http::baseUrl('https://api.razorpay.com/v1')->withBasicAuth(config('auraflare.razorpay.key_id'), config('auraflare.razorpay.key_secret'))->acceptJson()->connectTimeout(5)->timeout(15);
    }

    public function createOrder(int $amount, string $receipt): array
    {
        return $this->request()->post('/orders', ['amount' => $amount, 'currency' => 'INR', 'receipt' => $receipt, 'partial_payment' => false])->throw()->json();
    }

    public function payment(string $id): array
    {
        return $this->request()->get('/payments/'.rawurlencode($id))->throw()->json();
    }

    public function ordersByReceipt(string $receipt): array
    {
        return array_values(array_filter($this->request()->get('/orders', ['receipt' => $receipt, 'count' => 100])->throw()->json('items', []), fn ($o) => ($o['receipt'] ?? null) === $receipt));
    }

    public function paymentsForOrder(string $id): array
    {
        return $this->request()->get('/orders/'.rawurlencode($id).'/payments')->throw()->json('items', []);
    }

    public function refund(string $paymentId, int $amount, string $reference): array
    {
        return $this->request()->post('/payments/'.rawurlencode($paymentId).'/refund', ['amount' => $amount, 'receipt' => $reference, 'notes' => ['internal_ref' => $reference]])->throw()->json();
    }

    public function refundsForPayment(string $paymentId): array
    {
        return $this->request()->get('/payments/'.rawurlencode($paymentId).'/refunds', ['count' => 100])->throw()->json('items', []);
    }
}
