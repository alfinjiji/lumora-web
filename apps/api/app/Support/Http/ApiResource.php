<?php

namespace App\Support\Http;

use Illuminate\Http\Resources\Json\JsonResource;

class ApiResource extends JsonResource
{
    public function toArray($request): array
    {
        return $this->resource;
    }
}
