<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Route;
use Tests\TestCase;

final class RouteCoverageTest extends TestCase
{
    public function test_every_frozen_contract_operation_has_an_explicit_runtime_route(): void
    {
        $spec = json_decode(file_get_contents(resource_path('contract.json')), true);
        $count = 0;
        foreach ($spec['paths'] as $path => $methods) {
            foreach ($methods as $method => $op) {
                if (! isset($op['operationId'])) {
                    continue;
                }
                $found = false;
                foreach (Route::getRoutes() as $route) {
                    if ('/'.$route->uri() === $path && in_array(strtoupper($method), $route->methods())) {
                        $found = true;
                        break;
                    }
                }
                $this->assertTrue($found, strtoupper($method).' '.$path);
                $count++;
            }
        }
        $this->assertSame(104, $count);
    }
}
