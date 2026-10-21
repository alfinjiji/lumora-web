<?php

namespace App\Support;

final class Version
{
    public static function check(object $record, int $expected): void
    {
        ApiError::ensure((int) $record->version === $expected, 'VERSION_CONFLICT', 'This record changed. Reload and try again.');
    }
}
