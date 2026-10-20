<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    public function createApplication()
    {
        foreach (['APP_ENV' => 'testing', 'DB_DATABASE' => 'auraflare_test', 'SESSION_DRIVER' => 'array', 'CACHE_STORE' => 'array', 'QUEUE_CONNECTION' => 'sync', 'MAIL_MAILER' => 'array', 'FILESYSTEM_DISK' => 'local', 'MEDIA_PUBLIC_DISK' => 'public', 'MEDIA_PRIVATE_DISK' => 'local', 'EXTERNAL_MAIL_ENABLED' => 'false', 'RAZORPAY_MODE' => 'disabled', 'REDIS_PREFIX' => 'auraflare_test_', 'CACHE_PREFIX' => 'auraflare_test_', 'REDIS_QUEUE' => 'auraflare_test'] as $key => $value) {
            putenv($key.'='.$value);
            $_ENV[$key] = $value;
            $_SERVER[$key] = $value;
        }
        $app = parent::createApplication();
        if (config('database.connections.mysql.database') !== 'auraflare_test' || ! $app->environment('testing')) {
            throw new \RuntimeException('Refusing tests outside the isolated MySQL test database.');
        }

        return $app;
    }
}
