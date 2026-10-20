<?php

namespace App\Modules\Delivery\Http;

use App\Modules\Delivery\Actions\CheckDelivery;
use App\Modules\Delivery\Models\Rule;
use App\Support\Actor;
use App\Support\ApiError;
use App\Support\Audit;
use App\Support\ContractRequest;
use App\Support\Http\ApiController;
use App\Support\Version;
use Illuminate\Support\Facades\DB;

final class DeliveryController extends ApiController
{
    public function check(ContractRequest $r)
    {
        $yes = app(CheckDelivery::class)->execute($r->validated());

        return $this->ok(['serviceable' => $yes, 'shipping_charge_status' => 'owner_confirmation_required', 'message' => $yes ? 'Delivery is available; the studio will confirm shipping charges.' : 'Delivery is not currently available to this location.']);
    }

    public static function project(Rule $r): array
    {
        return ['id' => $r->public_id] + $r->only(['kind', 'state_code', 'city', 'postcode', 'allow', 'active', 'priority', 'version']);
    }

    public function index()
    {
        return $this->listing(Rule::orderByDesc('priority')->orderBy('id'), fn ($r) => self::project($r));
    }

    public function save(ContractRequest $r, ?string $ruleId = null)
    {
        $d = $r->validated();
        ApiError::ensure(! isset($d['state_code']) || in_array($d['state_code'], CheckDelivery::STATES), 'VALIDATION_ERROR', 'Use a valid Indian state/territory code.', 422);
        $rule = DB::transaction(function () use ($d, $ruleId) {
            $rule = $ruleId ? Rule::where('public_id', $ruleId)->lockForUpdate()->firstOrFail() : new Rule;
            if ($ruleId) {
                Version::check($rule, $d['expected_version']);
            }$rule->fill(array_diff_key($d, ['expected_version' => 1]));
            ApiError::ensure(($rule->kind !== 'city' || strlen(trim($rule->city ?? '')) > 0) && ($rule->kind !== 'postcode' || preg_match('/^[1-9][0-9]{5}$/', $rule->postcode ?? '')), 'VALIDATION_ERROR', 'Complete the location fields for this rule.', 422);
            ApiError::ensure($rule->kind !== 'postcode' || $rule->state_code !== 'KL' || preg_match('/^(67|68|69)[0-9]{4}$/', $rule->postcode), 'VALIDATION_ERROR', 'Use a Kerala postal prefix for a Kerala PIN rule.', 422);
            if ($ruleId) {
                $rule->version++;
            }$rule->save();
            Audit::write(Actor::request(), 'delivery.saved', 'rule', $rule->public_id);

            return $rule;
        });

        return $this->ok(self::project($rule), $ruleId ? 200 : 201);
    }
}
