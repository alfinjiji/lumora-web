<?php

namespace App\Modules\Delivery\Actions;

use App\Modules\Delivery\Models\Rule;

final class CheckDelivery
{
    public const STATES = ['AN', 'AP', 'AR', 'AS', 'BR', 'CH', 'CG', 'DN', 'DD', 'DL', 'GA', 'GJ', 'HR', 'HP', 'JK', 'JH', 'KA', 'KL', 'LA', 'LD', 'MP', 'MH', 'MN', 'ML', 'MZ', 'NL', 'OD', 'PY', 'PB', 'RJ', 'SK', 'TN', 'TS', 'TR', 'UP', 'UK', 'WB'];

    public function execute(array $a): bool
    {
        if (($a['country_code'] ?? 'IN') !== 'IN') {
            return false;
        }
        if (! in_array($a['state_code'] ?? '', self::STATES) || ! preg_match('/^[1-9][0-9]{5}$/', $a['postcode'] ?? '')) {
            return false;
        }
        if (($a['state_code'] ?? '') === 'KL' && ! preg_match('/^(67|68|69)[0-9]{4}$/', $a['postcode'])) {
            return false;
        }
        $rules = Rule::where('active', true)->where('state_code', $a['state_code'])->orderByDesc('priority')->orderByDesc('id')->get();
        $postcode = $rules->where('kind', 'postcode')->where('postcode', $a['postcode']);
        if ($postcode->contains('allow', false)) {
            return false;
        }if ($postcode->contains('allow', true)) {
            return true;
        }
        $city = $rules->filter(fn ($r) => $r->kind === 'city' && mb_strtolower(trim($r->city)) === mb_strtolower(trim($a['city'])));
        if ($city->isNotEmpty()) {
            return (bool) $city->first()->allow;
        }
        $state = $rules->firstWhere('kind', 'state');

        return $state ? (bool) $state->allow : false;
    }
}
