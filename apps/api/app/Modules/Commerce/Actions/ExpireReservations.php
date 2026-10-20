<?php

namespace App\Modules\Commerce\Actions;

use App\Modules\Inventory\Actions\LockOrderStock;
use App\Modules\Inventory\Models\Reservation;
use App\Support\Actor;
use App\Support\Audit;

final class ExpireReservations
{
    public function execute(): int
    {
        $n = 0;
        foreach (Reservation::where('status', 'active')->where('expires_at', '<=', now())->orderBy('id')->limit(500)->get() as $record) {
            app(LockOrderStock::class)->execute($record->order_id, function ($o, $r, $balances) use (&$n) {
                if ($r->status !== 'active' || $r->expires_at->isFuture()) {
                    return;
                }$a = new Actor(null, 'scheduler');
                app(LockOrderStock::class)->effect($o, $r, $balances, 'release', $a);
                if (! in_array($o->status, ['cancelled', 'completed'])) {
                    $o->update(['status' => 'expired', 'version' => $o->version + 1]);
                }Audit::write($a, 'reservation.expired', 'order', $o->public_id);
                $n++;
            });
        }

        return $n;
    }
}
