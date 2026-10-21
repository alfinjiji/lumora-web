<?php

namespace App\Modules\Payments\Contracts;

interface RazorpayGateway
{
    public function createOrder(int $amount, string $receipt): array;

    public function payment(string $id): array;

    public function ordersByReceipt(string $receipt): array;

    public function paymentsForOrder(string $id): array;

    public function refund(string $paymentId, int $amount, string $reference): array;

    public function refundsForPayment(string $paymentId): array;
}
