<?php

namespace App\Modules\Reporting\Jobs;

use App\Modules\Commerce\Models\Order;
use App\Modules\Reporting\Models\Export;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Storage;

final class GenerateOrderExport implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public function failed(?\Throwable $exception): void
    {
        Export::whereKey($this->exportId)->where('status', '!=', 'ready')->update(['status' => 'failed']);
    }

    public function __construct(public int $exportId) {}

    public function handle(): void
    {
        $e = Export::findOrFail($this->exportId);
        if ($e->status === 'ready') {
            return;
        }$e->update(['status' => 'processing']);
        $q = Order::whereBetween('created_at', [$e->filters['from'], $e->filters['to']])->orderBy('id');
        if (! empty($e->filters['status'])) {
            $q->where('status', $e->filters['status']);
        }$file = fopen('php://temp', 'w+');
        fputcsv($file, ['Order', 'Customer', 'Status', 'Payment', 'Total INR paise', 'Requested UTC'], ',', '"', '');
        foreach ($q->cursor() as $o) {
            $name = $o->contact['name'];
            if (preg_match('/^[\s]*[=+@\-\t\r]/u', $name)) {
                $name = "'".$name;
            }fputcsv($file, [$o->number, $name, $o->status, $o->payment_status, $o->total_minor, $o->created_at->toISOString()], ',', '"', '');
        }rewind($file);
        $key = 'exports/'.$e->public_id.'.csv';
        if (! Storage::disk('local')->put($key, stream_get_contents($file))) {
            throw new \RuntimeException('Private export storage unavailable.');
        }
        fclose($file);
        $e->update(['status' => 'ready', 'key' => $key, 'expires_at' => now()->addHours(24)]);
    }
}
