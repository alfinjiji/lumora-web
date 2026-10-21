<?php

namespace Tests\Support;

use App\Modules\Payments\Contracts\RazorpayGateway;

final class FakeGateway implements RazorpayGateway
{
    public array $orders = [];

    public array $payments = [];

    public array $refunds = [];

    public bool $timeoutAfterCreate = false;

    public int $creates = 0;

    public function createOrder(int $amount, string $receipt): array
    {
        $this->creates++;
        $o = ['id' => 'order_fixture_'.$receipt, 'amount' => $amount, 'currency' => 'INR', 'receipt' => $receipt];
        $this->orders[] = $o;
        if ($this->timeoutAfterCreate) {
            throw new \RuntimeException('Synthetic response timeout after provider success');
        }

        return $o;
    }

    public function payment(string $id): array
    {
        return $this->payments[$id];
    }

    public function ordersByReceipt(string $receipt): array
    {
        return array_values(array_filter($this->orders, fn ($o) => $o['receipt'] === $receipt));
    }

    public function paymentsForOrder(string $id): array
    {
        return array_values(array_filter($this->payments, fn ($p) => $p['order_id'] === $id));
    }

    public function refund(string $paymentId, int $amount, string $reference): array
    {
        $r = ['id' => 'rf_fixture_'.$reference, 'payment_id' => $paymentId, 'amount' => $amount, 'receipt' => $reference, 'status' => 'processed'];
        $this->refunds[] = $r;

        return $r;
    }

    public function refundsForPayment(string $paymentId): array
    {
        return array_values(array_filter($this->refunds, fn ($r) => $r['payment_id'] === $paymentId));
    }
}
