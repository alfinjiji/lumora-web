<?php

namespace App\Providers;

use App\Modules\Commerce\Models\Order;
use App\Modules\Payments\Adapters\RazorpayHttpGateway;
use App\Modules\Payments\Contracts\RazorpayGateway;
use App\Policies\OrderPolicy;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(RazorpayGateway::class, RazorpayHttpGateway::class);
    }

    public function boot(): void
    {
        URL::forceRootUrl(config('app.url'));
        if (str_starts_with(config('app.url'), 'https://')) {
            URL::forceScheme('https');
        }
        RateLimiter::for('login', fn ($r) => Limit::perMinute(15)->by($r->ip()));
        RateLimiter::for('api', fn ($r) => Limit::perMinute(180)->by($r->user()?->id ?? $r->session()->getId().$r->ip()));
        RateLimiter::for('order-intake', function ($r) {
            $email = $r->input('contact.email');

            return [Limit::perMinute(6)->by('intake-ip:'.$r->ip()), Limit::perMinute(3)->by('intake-session:'.$r->session()->getId()), Limit::perHour(10)->by('intake-email:'.hash('sha256', is_string($email) ? strtolower(trim($email)) : 'invalid'))];
        });
        RateLimiter::for('identity-link', function ($r) {
            $email = $r->input('email');

            return [Limit::perMinute(10)->by('link-ip:'.$r->ip()), Limit::perHour(10)->by('link-email:'.hash('sha256', is_string($email) ? strtolower(trim($email)) : 'invalid'))];
        });
        Gate::policy(Order::class, OrderPolicy::class);
    }
}
