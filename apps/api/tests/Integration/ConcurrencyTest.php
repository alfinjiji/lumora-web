<?php

namespace Tests\Integration;

use App\Modules\Commerce\Actions\ExpireReservations;
use App\Modules\Commerce\Actions\IssueShippingQuote;
use App\Modules\Commerce\Models\Quote;
use App\Modules\Identity\Actions\ChangeStaffMembership;
use App\Modules\Identity\Models\StaffMembership;
use App\Modules\Inventory\Actions\AdjustInventory;
use App\Modules\Inventory\Models\Balance;
use App\Modules\Inventory\Models\Movement;
use App\Modules\Inventory\Models\Reservation;
use App\Modules\Payments\Actions\CreateRazorpayAttempt;
use App\Modules\Payments\Actions\SettleOrderPayment;
use App\Modules\Payments\Contracts\RazorpayGateway;
use App\Support\Actor;
use App\Support\ApiError;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Tests\Support\FakeGateway;
use Tests\Support\StudioFixtures;
use Tests\TestCase;

final class ConcurrencyTest extends TestCase
{
    use StudioFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->configureCommerce();
    }

    private function race(array $work): array
    {
        $dir = sys_get_temp_dir().'/auraflare-race-'.bin2hex(random_bytes(8));
        mkdir($dir, 0700);
        DB::disconnect();
        $pids = [];
        foreach ($work as $i => $task) {
            $pid = pcntl_fork();
            if ($pid === 0) {
                try {
                    DB::purge();
                    DB::connection()->getPdo();
                    touch($dir.'/ready-'.$i);
                    $deadline = microtime(true) + 10;
                    while (! file_exists($dir.'/go')) {
                        if (microtime(true) > $deadline) {
                            throw new \RuntimeException('Barrier timeout');
                        }usleep(1000);
                    }$result = $task();
                    file_put_contents($dir.'/result-'.$i, json_encode(['ok' => true, 'result' => $result]));
                } catch (ApiError $e) {
                    file_put_contents($dir.'/result-'.$i, json_encode(['ok' => false, 'code' => $e->errorCode]));
                } catch (\Throwable $e) {
                    file_put_contents($dir.'/result-'.$i, json_encode(['ok' => false, 'unexpected' => get_class($e).': '.$e->getMessage()]));
                }exit(0);
            }if ($pid < 0) {
                throw new \RuntimeException('Could not fork concurrency worker');
            }$pids[] = $pid;
        }
        $deadline = microtime(true) + 15;
        while (count(glob($dir.'/ready-*')) < count($work)) {
            if (microtime(true) > $deadline) {
                throw new \RuntimeException('Workers did not become ready');
            }usleep(1000);
        }touch($dir.'/go');
        foreach ($pids as $pid) {
            pcntl_waitpid($pid, $status);
        }DB::purge();
        $results = [];
        foreach (array_keys($work) as $i) {
            $result = json_decode(file_get_contents($dir.'/result-'.$i), true);
            $this->assertArrayNotHasKey('unexpected', $result, json_encode($result));
            $results[] = $result;
        }foreach (glob($dir.'/*') as $f) {
            unlink($f);
        }rmdir($dir);

        return $results;
    }

    public function test_two_real_mysql_connections_cannot_both_reserve_the_last_unit(): void
    {
        $v = $this->variant(1);
        $r = $this->race([fn () => $this->order($v, new Actor(null, 'guest-a'))->public_id, fn () => $this->order($v, new Actor(null, 'guest-b'))->public_id]);
        $this->assertSame(1, count(array_filter($r, fn ($x) => $x['ok'])));
        $this->assertSame(1, Balance::where('variant_id', $v->id)->first()->reserved);
    }

    public function test_concurrent_adjustments_preserve_nonnegative_stock_and_version(): void
    {
        $v = $this->variant(10);
        $u = $this->person('fulfillment');
        $a = new Actor($u, 'staff');
        $f = fn () => app(AdjustInventory::class)->execute($v->public_id, ['expected_version' => 1, 'on_hand_delta' => -6, 'reason' => 'Concurrent synthetic count'], $a)->on_hand;
        $r = $this->race([$f, $f]);
        $this->assertSame(1, count(array_filter($r, fn ($x) => $x['ok'])));
        $this->assertSame(4, Balance::where('variant_id', $v->id)->first()->on_hand);
    }

    public function test_parallel_owner_deactivations_leave_one_usable_owner(): void
    {
        DB::table('staff_memberships')->where('role', 'owner')->update(['active' => false]);
        $a = $this->person('owner');
        $b = $this->person('owner');
        $ma = StaffMembership::where('user_id', $a->id)->first();
        $mb = StaffMembership::where('user_id', $b->id)->first();
        $r = $this->race([fn () => app(ChangeStaffMembership::class)->execute($ma->public_id, ['expected_version' => 1, 'active' => false], new Actor($a, 'a'))->active, fn () => app(ChangeStaffMembership::class)->execute($mb->public_id, ['expected_version' => 1, 'active' => false], new Actor($b, 'b'))->active]);
        $this->assertSame(1, count(array_filter($r, fn ($x) => $x['ok'])));
        $this->assertSame(1, StaffMembership::where('role', 'owner')->where('active', true)->count());
    }

    private function paymentFixture(): array
    {
        $v = $this->variant(2);
        $o = $this->order($v);
        $owner = $this->person('owner');
        $o = app(IssueShippingQuote::class)->execute($o, ['expected_version' => 1, 'shipping_minor' => 1000, 'expires_at' => now()->addHour()->toISOString()], new Actor($owner, 'owner'));
        $q = Quote::find($o->current_quote_id);
        $this->app->instance(RazorpayGateway::class, new FakeGateway);
        $p = app(CreateRazorpayAttempt::class)->execute($o, ['quote_id' => $q->public_id, 'quote_version' => 1, 'accept_quote' => true], new Actor(null, 'guest-fixture'), 'concurrency-payment-key');

        return [$v, $o, $p];
    }

    public function test_callback_and_webhook_race_produce_one_receipt_and_stock_consumption(): void
    {
        [$v,$o,$p] = $this->paymentFixture();
        $facts = ['id' => 'pay_race_'.bin2hex(random_bytes(5)), 'order_id' => $p->provider_order_id, 'amount' => $p->amount_minor, 'currency' => 'INR', 'status' => 'captured'];
        $f = fn () => app(SettleOrderPayment::class)->execute($p, $facts, new Actor(null, 'concurrent-verification'))->status;
        $this->race([$f, $f]);
        $this->assertSame(1, DB::table('payment_receipts')->where('attempt_id', $p->id)->count());
        $b = Balance::where('variant_id', $v->id)->first();
        $this->assertSame(1, $b->on_hand);
        $this->assertSame(0, $b->reserved);
    }

    public function test_expiry_payment_race_has_one_stock_effect_and_never_resurrects_a_released_hold(): void
    {
        [$v,$o,$p] = $this->paymentFixture();
        $t = now();
        Reservation::where('order_id', $o->id)->update(['expires_at' => $t->copy()->addSeconds(30)]);
        $facts = ['id' => 'pay_boundary_'.bin2hex(random_bytes(4)), 'order_id' => $p->provider_order_id, 'amount' => $p->amount_minor, 'currency' => 'INR', 'status' => 'captured'];
        $this->race([function () use ($p, $facts, $t) {
            Carbon::setTestNow($t);

            return app(SettleOrderPayment::class)->execute($p, $facts, new Actor(null, 'callback'))->status;
        }, function () use ($t) {
            Carbon::setTestNow($t->copy()->addMinute());

            return app(ExpireReservations::class)->execute();
        }]);
        $o->refresh();
        $b = Balance::where('variant_id', $v->id)->first();
        $this->assertSame(0, $b->reserved);
        $this->assertContains($o->payment_status, ['paid', 'exception']);
        $this->assertSame($o->payment_status === 'paid' ? 1 : 2, $b->on_hand);
        $this->assertSame(1, Movement::where('order_id', $o->id)->where('reserved_delta', -1)->count());
    }
}
