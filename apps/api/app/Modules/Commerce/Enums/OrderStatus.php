<?php

namespace App\Modules\Commerce\Enums;

enum OrderStatus: string
{
    case AwaitingShippingQuote = 'awaiting_shipping_quote';
    case AwaitingPayment = 'awaiting_payment';
    case PaymentReview = 'payment_review';
    case Confirmed = 'confirmed';
    case Completed = 'completed';
    case Cancelled = 'cancelled';
    case Expired = 'expired';
}
