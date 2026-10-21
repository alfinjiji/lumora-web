<?php

namespace App\Modules\Payments\Actions;

use App\Modules\Commerce\Models\Quote;
use App\Support\ApiError;

final class AcceptQuote
{
    public function execute($o, $r, array $d): Quote
    {
        ApiError::ensure($o->status === 'awaiting_payment' && $r->status === 'active' && $r->expires_at->isFuture(), 'QUOTE_EXPIRED', 'This order or reservation has expired.');
        $q = Quote::whereKey($o->current_quote_id)->lockForUpdate()->first();
        ApiError::ensure((bool) $q, 'QUOTE_REQUIRED', 'A shipping quote is required.');
        ApiError::ensure($q->public_id === $d['quote_id'] && $q->version === $d['quote_version'], 'QUOTE_SUPERSEDED', 'Review the latest quote before paying.');
        ApiError::ensure($q->expires_at->isFuture() && in_array($q->status, ['current', 'accepted']), 'QUOTE_EXPIRED', 'This quote has expired.');
        $q->update(['status' => 'accepted', 'accepted_at' => $q->accepted_at ?? now()]);

        return $q;
    }
}
