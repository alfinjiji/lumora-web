<?php

namespace App\Modules\Commerce\Data;

final readonly class SubmitOrderData
{
    public function __construct(public array $contact, public array $address, public array $items, public string $source = 'website', public string $note = '') {}
}
