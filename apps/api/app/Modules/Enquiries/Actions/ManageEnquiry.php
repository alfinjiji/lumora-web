<?php

namespace App\Modules\Enquiries\Actions;

use App\Models\User;
use App\Modules\Catalog\Models\Product;
use App\Modules\Enquiries\Models\Enquiry;
use App\Support\Actor;
use App\Support\ApiError;
use App\Support\Audit;
use App\Support\Version;
use Illuminate\Support\Facades\DB;

final class ManageEnquiry
{
    public function execute(array $d, Actor $a, ?string $id = null, bool $admin = false): Enquiry
    {
        if ($admin || $id) {
            $a->staff();
        }

        return DB::transaction(function () use ($d, $a, $id) {
            $e = $id ? Enquiry::where('public_id', $id)->lockForUpdate()->firstOrFail() : new Enquiry;
            if ($id) {
                Version::check($e, $d['expected_version']);
            }$e->fill(array_intersect_key($d, array_flip(['contact', 'source', 'message', 'event_date', 'quantity', 'status'])));
            if (array_key_exists('product_id', $d)) {
                $e->product_id = $d['product_id'] ? Product::where('public_id', $d['product_id'])->firstOrFail()->id : null;
            }if (array_key_exists('assigned_to', $d)) {
                $u = $d['assigned_to'] ? User::where('public_id', $d['assigned_to'])->firstOrFail() : null;
                if ($u) {
                    ApiError::ensure(DB::table('staff_memberships')->where('user_id', $u->id)->where('active', true)->exists(), 'VALIDATION_ERROR', 'Assign to an active team member.', 422);
                }$e->assigned_to = $u?->id;
            }if ($id) {
                $e->version++;
            }$e->save();
            Audit::write($a, $id ? 'enquiry.updated' : 'enquiry.created', 'enquiry', $e->public_id);

            return $e;
        });
    }

    public static function project(Enquiry $e): array
    {
        return ['id' => $e->public_id, 'contact' => $e->contact, 'source' => $e->source, 'message' => $e->message, 'product_id' => $e->product_id ? Product::findOrFail($e->product_id)->public_id : null, 'event_date' => $e->event_date?->format('Y-m-d'), 'quantity' => $e->quantity, 'status' => $e->status, 'assigned_to' => $e->assigned_to ? User::findOrFail($e->assigned_to)->public_id : null, 'version' => $e->version];
    }
}
