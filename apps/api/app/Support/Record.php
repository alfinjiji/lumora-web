<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

abstract class Record extends Model
{
    protected $guarded = ['id'];

    protected static function booted(): void
    {
        static::creating(function ($model) {
            $model->public_id ??= (string) Str::ulid();
            if ($model->hasCast('version')) {
                $model->version ??= 1;
            }
        });
    }

    public function getRouteKeyName(): string
    {
        return 'public_id';
    }
}
