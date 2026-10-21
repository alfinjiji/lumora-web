<?php

namespace App\Modules\Commerce\Enums;

enum PaymentStatus: string
{
    case Unpaid = 'unpaid';
    case Pending = 'pending';
    case UnderReview = 'under_review';
    case Paid = 'paid';
    case Exception = 'exception';
    case RefundPending = 'refund_pending';
    case Refunded = 'refunded';
}
