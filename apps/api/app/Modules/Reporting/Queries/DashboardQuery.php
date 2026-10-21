<?php

namespace App\Modules\Reporting\Queries;

use App\Modules\Commerce\Models\Order;
use App\Modules\Inventory\Models\Balance;
use App\Modules\Payments\Models\Evidence;
use App\Modules\Payments\Models\Refund;
use App\Support\Actor;
use App\Support\ApiError;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class DashboardQuery
{
    public function execute(Actor $a, ?string $from = null, ?string $to = null): array
    {
        $a->staff();
        $start = $from ? Carbon::parse($from) : now('Asia/Kolkata')->startOfDay()->startOfMonth();
        $end = $to ? Carbon::parse($to) : now('Asia/Kolkata')->endOfDay();
        ApiError::ensure($start->lte($end) && $start->diffInDays($end) <= 366, 'VALIDATION_ERROR', 'Choose an ordered reporting period within 366 days.', 422);
        $start = $start->utc();
        $end = $end->utc();
        $money = null;
        if ($a->role() === 'owner') {
            $money = (int) DB::table('payment_receipts')->whereBetween('received_at', [$start, $end])->sum('amount_minor') - (int) Refund::where('status', 'succeeded')->whereBetween('refunded_at', [$start, $end])->sum('amount_minor');
        }

        return ['period_start' => $start->toISOString(), 'period_end' => $end->toISOString(), 'timezone' => 'Asia/Kolkata', 'order_requests' => Order::whereBetween('created_at', [$start, $end])->count(), 'awaiting_shipping_quote' => Order::where('status', 'awaiting_shipping_quote')->count(), 'low_stock_variants' => Balance::whereRaw('on_hand-reserved<=low_stock_threshold')->count(), 'manual_payments_under_review' => Evidence::where('status', 'under_review')->count(), 'net_receipts_minor' => $money];
    }
}
