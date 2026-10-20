<?php

namespace App\Support;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\ValidationException;

class ContractRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('email'))) {
            $this->merge(['email' => strtolower(trim($this->input('email')))]);
        }
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($v) {
            foreach ($v->getRules() as $key => $rules) {
                $value = data_get($this->all(), $key);
                if ($value === null) {
                    continue;
                }if (in_array('integer', $rules) && (! is_int($value) || abs($value) > 9007199254740991)) {
                    $v->errors()->add($key, 'Use an integer JSON value in the supported range.');
                }if (in_array('boolean', $rules) && ! is_bool($value)) {
                    $v->errors()->add($key, 'Use a boolean JSON value.');
                }
            }
        });
    }

    public function rules(): array
    {
        $name = $this->route()?->defaults['input'] ?? null;
        if (! $name) {
            return [];
        }
        $all = json_decode(file_get_contents(resource_path('input-rules.json')), true, 512, JSON_THROW_ON_ERROR);
        $rules = $all[$name] ?? [];
        $allowed = array_filter(array_keys($rules), fn ($k) => ! str_contains($k, '.'));
        $unknown = array_diff(array_keys($this->all()), $allowed);
        if ($unknown) {
            throw ValidationException::withMessages(array_fill_keys($unknown, 'Unknown input field.'));
        }

        return $rules;
    }
}
