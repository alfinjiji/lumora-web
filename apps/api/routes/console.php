<?php

use App\Modules\Commerce\Actions\ExpireReservations;
use App\Modules\Identity\Models\Invitation;
use App\Modules\Media\Actions\RescanProofs;
use App\Modules\Media\Models\Media;
use App\Modules\Payments\Actions\ReconcilePayment;
use App\Modules\Payments\Actions\RequestRefund;
use App\Modules\Payments\Jobs\ProcessWebhook;
use App\Modules\Payments\Models\Attempt;
use App\Modules\Payments\Models\Refund;
use App\Modules\Payments\Models\WebhookEvent;
use App\Support\Audit;
use App\Support\Outbox\DeliverMessage;
use App\Support\Outbox\Heartbeat;
use App\Support\ProductionConfiguration;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schedule;
use Illuminate\Support\Facades\Storage;

Artisan::command('auraflare:owner', function () {
    $email = strtolower(trim($this->ask('Owner email')));
    $name = trim($this->ask('Owner name'));
    if (! filter_var($email, FILTER_VALIDATE_EMAIL) || ! $name) {
        $this->error('A valid email and name are required.');

        return 1;
    }
    DB::transaction(function () use ($email, $name) {
        DB::table('identity_locks')->where('name', 'owners')->lockForUpdate()->first();
        if (DB::table('staff_memberships')->where('role', 'owner')->where('active', true)->exists()) {
            throw new RuntimeException('Use an existing owner to invite another team member.');
        }if (Invitation::where('role', 'owner')->whereNull('accepted_at')->whereNull('revoked_at')->where('expires_at', '>', now())->exists()) {
            throw new RuntimeException('An owner invitation is already pending.');
        }$raw = bin2hex(random_bytes(32));
        $i = Invitation::create(['email' => $email, 'name' => $name, 'role' => 'owner', 'token_hash' => hash('sha256', $raw), 'expires_at' => now()->addHours(24)]);
        Audit::outbox('invite:'.$i->public_id, 'invitation', ['email' => $email, 'token' => Crypt::encryptString($raw)]);
    });
    $this->info('Owner setup queued. Inspect the private local mail preview; no email was sent.');
})->purpose('Create the first owner through a private invitation; no default password');
Artisan::command('auraflare:work-outbox', function () {
    foreach (DB::table('outbox_messages')->where('status', 'pending')->orderBy('id')->limit(100)->get() as $m) {
        DeliverMessage::dispatchSync($m->id);
    }$this->info('Local outbox processed; inspect storage/app/private/mail-previews privately.');
});
Artisan::command('auraflare:reconcile', function () {
    foreach (Attempt::where('method', 'razorpay')->whereIn('status', ['created', 'unknown', 'pending', 'authorized'])->where('updated_at', '<', now()->subMinute())->limit(100)->get() as $p) {
        try {
            app(ReconcilePayment::class)->execute($p);
        } catch (Throwable) {
            report(new RuntimeException('Payment reconciliation needs retry for attempt '.$p->public_id));
        }
    }foreach (Refund::whereIn('status', ['requested', 'processing'])->limit(100)->get() as $r) {
        try {
            app(RequestRefund::class)->reconcile($r);
        } catch (Throwable) {
            report(new RuntimeException('Refund reconciliation needs retry for refund '.$r->public_id));
        }
    }
});
Schedule::call(fn () => app(ExpireReservations::class)->execute())->everyMinute()->name('auraflare-holds')->onOneServer()->withoutOverlapping();
Schedule::call(function () {
    foreach (DB::table('outbox_messages')->where('status', 'pending')->orderBy('id')->limit(100)->get() as $m) {
        DeliverMessage::dispatch($m->id);
    }foreach (WebhookEvent::whereNull('processed_at')->orderBy('id')->limit(100)->get() as $e) {
        ProcessWebhook::dispatch($e->id);
    }
})->everyMinute()->name('auraflare-outbox-inbox')->onOneServer()->withoutOverlapping();
Schedule::command('auraflare:reconcile')->everyFiveMinutes()->onOneServer()->withoutOverlapping();

Artisan::command('auraflare:scan-proofs', function () {
    $this->info('Proofs cleared: '.app(RescanProofs::class)->execute());
});
Schedule::command('auraflare:scan-proofs')->everyFiveMinutes()->onOneServer()->withoutOverlapping();
// Only unattached, non-proof uploads are eligible. Financial evidence is retained.
Artisan::command('auraflare:prune-uploads', function () {
    $removed = 0;
    foreach (Media::whereNull('attached_at')->where('purpose', '!=', 'manual_payment_proof')->where('created_at', '<', now()->subDays(7))->limit(100)->get() as $media) {
        if (DB::table('product_media')->where('media_id', $media->id)->exists() || DB::table('users')->where('avatar_media_id', $media->id)->exists()) {
            continue;
        }
        // Never delete a database record if object deletion failed.
        if (Storage::disk($media->disk)->delete($media->key)) {
            $media->delete();
            $removed++;
        }
    }
    $this->info('Unattached uploads removed: '.$removed);
});
Schedule::command('auraflare:prune-uploads')->daily()->onOneServer()->withoutOverlapping();

Artisan::command('auraflare:check {--production}', function () {
    $issues = ProductionConfiguration::issues((bool) $this->option('production'));
    foreach ($issues as $issue) {
        $this->error('Required configuration: '.$issue);
    }
    if ($issues) {
        return 1;
    }
    $this->info('Configuration checks passed. Checkout '.(config('auraflare.checkout_enabled') ? 'enabled' : 'disabled').'. This does not qualify live providers.');

    return 0;
});
Schedule::call(function () {
    Cache::store('redis')->put('health:scheduler', now()->timestamp, 300);
    Heartbeat::dispatch();
})->everyMinute()->name('auraflare-heartbeat')->onOneServer()->withoutOverlapping();
