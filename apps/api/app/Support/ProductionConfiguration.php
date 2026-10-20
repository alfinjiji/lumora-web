<?php

namespace App\Support;

final class ProductionConfiguration
{
    /** Configuration names only: values and secrets must never appear in health output. */
    public static function issues(bool $production = false): array
    {
        $issues = [];
        if (! config('app.key')) {
            $issues[] = 'APP_KEY';
        }
        if (config('database.default') !== 'mysql') {
            $issues[] = 'DB_CONNECTION=mysql';
        }
        if ($production || app()->environment('production')) {
            if (config('app.debug')) {
                $issues[] = 'APP_DEBUG=false';
            }
            if (! str_starts_with(config('app.url'), 'https://')) {
                $issues[] = 'APP_URL=https';
            }
            if (! config('session.secure')) {
                $issues[] = 'SESSION_SECURE_COOKIE=true';
            }
            if (config('session.domain')) {
                $issues[] = 'SESSION_DOMAIN must be empty';
            }
            if (config('auraflare.checkout_enabled')) {
                if (! config('auraflare.business_config_approved')) {
                    $issues[] = 'BUSINESS_CONFIG_APPROVED';
                }
                if (! config('auraflare.external_mail_enabled')) {
                    $issues[] = 'EXTERNAL_MAIL_ENABLED';
                }
                if (! in_array(config('auraflare.tax_policy'), ['none', 'exclusive'])) {
                    $issues[] = 'TAX_POLICY';
                }
                if (config('auraflare.razorpay.mode') !== 'live' || ! str_starts_with((string) config('auraflare.razorpay.key_id'), 'rzp_live_') || ! config('auraflare.razorpay.key_secret') || ! config('auraflare.razorpay.webhook_secret')) {
                    $issues[] = 'RAZORPAY live configuration';
                }
            }
        }

        return $issues;
    }
}
