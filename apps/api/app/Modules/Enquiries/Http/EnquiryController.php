<?php

namespace App\Modules\Enquiries\Http;

use App\Models\User;
use App\Modules\Enquiries\Actions\ManageEnquiry;
use App\Modules\Enquiries\Models\Enquiry;
use App\Modules\Enquiries\Models\Note;
use App\Support\Actor;
use App\Support\ContractRequest;
use App\Support\Http\ApiController;

final class EnquiryController extends ApiController
{
    public function index()
    {
        $q = Enquiry::orderByDesc('id');
        if ($s = request('status')) {
            $q->where('status', $s);
        }

        return $this->listing($q, fn ($e) => ManageEnquiry::project($e));
    }

    public function save(ContractRequest $r, ?string $enquiryId = null)
    {
        $admin = str_contains($r->path(), '/admin/');
        $e = app(ManageEnquiry::class)->execute($r->validated(), Actor::request(), $enquiryId, $admin);

        return $admin ? $this->ok(ManageEnquiry::project($e), $enquiryId ? 200 : 201) : $this->ack(201);
    }

    public function show(string $enquiryId)
    {
        return $this->ok(ManageEnquiry::project(Enquiry::where('public_id', $enquiryId)->firstOrFail()));
    }

    public static function note(Note $n): array
    {
        return ['id' => $n->public_id, 'body' => $n->body, 'actor_id' => User::findOrFail($n->actor_id)->public_id, 'created_at' => $n->created_at->toISOString()];
    }

    public function notes(string $enquiryId)
    {
        $e = Enquiry::where('public_id', $enquiryId)->firstOrFail();

        return $this->listing(Note::where('enquiry_id', $e->id)->orderBy('id'), fn ($n) => self::note($n));
    }

    public function addNote(ContractRequest $r, string $enquiryId)
    {
        $e = Enquiry::where('public_id', $enquiryId)->firstOrFail();
        $n = Note::create(['enquiry_id' => $e->id, 'actor_id' => auth()->id(), 'body' => $r->validated()['body']]);

        return $this->ok(self::note($n), 201);
    }
}
