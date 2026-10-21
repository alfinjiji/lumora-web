<?php

namespace App\Support;

use RuntimeException;

final class ApiError extends RuntimeException
{
    public function __construct(public readonly string $errorCode, string $message, public readonly int $status = 409, public readonly array $fields = [])
    {
        parent::__construct($message);
    }

    public static function ensure(bool $condition, string $code, string $message, int $status = 409): void
    {
        if (! $condition) {
            throw new self($code, $message, $status);
        }
    }
}
