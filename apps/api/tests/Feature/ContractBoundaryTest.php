<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\StudioFixtures;
use Tests\TestCase;

final class ContractBoundaryTest extends TestCase
{
    use RefreshDatabase,StudioFixtures;

    public function test_every_account_route_requires_authentication_before_validation(): void
    {
        $spec = json_decode(file_get_contents(resource_path('contract.json')), true);
        foreach ($spec['paths'] as $path => $ops) {
            foreach ($ops as $method => $op) {
                if (! in_array($op['x-capability'] ?? null, ['authenticated', 'customer', 'verified-customer'])) {
                    continue;
                }
                $url = preg_replace('/\{[^}]+\}/', '01K7XB0X9PHZ2NE0GDS4B4YDKH', $path);
                $this->json(strtoupper($method), $url, [])->assertUnauthorized();
            }
        }
    }

    public function test_address_book_create_update_and_delete_remain_account_scoped(): void
    {
        $u = $this->person();
        $v = $this->person();
        $r = $this->actingAs($u)->postJson('/api/v1/me/addresses', $this->address())->assertCreated();
        $id = $r->json('data.id');
        $this->actingAs($v)->putJson('/api/v1/me/addresses/'.$id, $this->address())->assertNotFound();
        $this->actingAs($u)->putJson('/api/v1/me/addresses/'.$id, array_replace($this->address(), ['city' => 'Kochi', 'postcode' => '682001']))->assertOk()->assertJsonPath('data.city', 'Kochi');
        $this->deleteJson('/api/v1/me/addresses/'.$id)->assertNoContent();
    }

    public function test_signed_webhook_duplicate_is_durable_and_changed_body_is_rejected(): void
    {
        config(['auraflare.razorpay.webhook_secret' => 'synthetic-webhook-secret']);
        $payload = ['event' => 'unrecognised.synthetic', 'payload' => []];
        $raw = json_encode($payload);
        $headers = ['X-Razorpay-Event-Id' => 'synthetic-event-1', 'X-Razorpay-Signature' => hash_hmac('sha256', $raw, 'synthetic-webhook-secret')];
        $this->postJson('/webhooks/razorpay', $payload, $headers)->assertOk();
        $this->postJson('/webhooks/razorpay', $payload, $headers)->assertOk();
        $this->assertDatabaseCount('webhook_events', 1);
        $payload['event'] = 'changed.synthetic';
        $headers['X-Razorpay-Signature'] = hash_hmac('sha256', json_encode($payload), 'synthetic-webhook-secret');
        $this->postJson('/webhooks/razorpay', $payload, $headers)->assertStatus(400);
        $this->postJson('/webhooks/razorpay', $payload, ['X-Razorpay-Signature' => 'forged'])->assertStatus(400);
    }
}
