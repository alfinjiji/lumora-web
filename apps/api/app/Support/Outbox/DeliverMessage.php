<?php

namespace App\Support\Outbox;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;

final class DeliverMessage implements ShouldQueue
{
    use Queueable;

    public int $tries = 5;

    public function __construct(public int $messageId) {}

    public function handle(): void
    {
        Cache::lock('outbox:'.$this->messageId, 90)->block(5, function () {
            $m = DB::table('outbox_messages')->where('id', $this->messageId)->first();
            if (! $m || $m->status === 'delivered') {
                return;
            }$p = json_decode($m->payload, true);
            $subject = 'Auraflare studio update';
            $body = 'There is an update from Auraflare.';
            if (isset($p['token'])) {
                $token = Crypt::decryptString($p['token']);
                $path = match ($m->type) {
                    'invitation' => '/accept-invitation',default => match ($p['purpose'] ?? '') {
                        'reset' => '/reset-password','verify' => '/verify-email','email-change' => '/confirm-email','guest-order' => '/orders/access',default => '/login'
                    }
                };
                $body = 'Open your secure Auraflare page: '.rtrim(config('app.url'), '/').$path.'#token='.rawurlencode($token);
            } elseif (isset($p['order_id'])) {
                $body = 'View your order: '.rtrim(config('app.url'), '/').'/orders/'.$p['order_id']."\nUse the secure access-link request if you are opening this on a different browser.";
            }
            $key = 'mail-previews/'.$m->public_id.'.html';
            $html = '<!doctype html><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>Auraflare local email preview</title><h1>'.e($subject).'</h1><p>To: '.e($p['email'] ?? '').'</p><p>'.nl2br(e($body)).'</p>';
            Storage::disk('local')->put($key, $html);
            $path = Storage::disk('local')->path($key);
            if (is_file($path)) {
                chmod($path, 0600);
            }
            if (config('auraflare.external_mail_enabled')) {
                Mail::raw($body, fn ($mail) => $mail->to($p['email'])->subject($subject));
            }
            DB::transaction(function () use ($m) {
                DB::table('notification_deliveries')->insertOrIgnore(['outbox_id' => $m->id, 'sent_at' => now()]);
                DB::table('outbox_messages')->where('id', $m->id)->update(['status' => 'delivered', 'delivered_at' => now(), 'attempts' => $m->attempts + 1, 'updated_at' => now()]);
            });
        });
    }
}
