<?php

namespace App\Modules\Content\Http;

use App\Modules\Content\Actions\ManageHomeContent;
use App\Support\Actor;
use App\Support\ContractRequest;
use App\Support\Http\ApiController;

final class ContentController extends ApiController
{
    public function show(ManageHomeContent $c)
    {
        return $this->ok($c->project($c->current(! str_contains(request()->path(), '/admin/'))));
    }

    public function save(ContractRequest $r, ManageHomeContent $c)
    {
        return $this->ok($c->project($c->save($r->validated(), Actor::request())));
    }

    public function publish(ContractRequest $r, ManageHomeContent $c)
    {
        return $this->command($r, fn () => $c->project($c->publish($r->validated(), Actor::request())));
    }
}
