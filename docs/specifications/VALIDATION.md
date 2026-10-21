# Package validation

Performed 19 October 2026.

- YAML parsed successfully: 84 paths, 100 operations and 127 named schemas.
- All 1148 local schema references resolved; operation IDs are unique; path parameters match templates; required object properties exist; all admin operations declare owner/staff access.
- All 127 domain/envelope schemas passed JSON Schema Draft 4 schema checks after explicit translation of OpenAPI nullable to JSON Schema null unions.
- All 7 JSON examples parsed and passed their associated translated schema with format checking; examples are included in `examples/`.
- Endpoint index generated from the same in-memory contract as YAML. Documentation reviewed against interview answers and design-reference documentation.
- Archive CRC and expected entry presence checked after packaging.

Limits: a full OpenAPI-spec-validator package was unavailable in this environment; structural and schema checks above do not claim full OpenAPI tooling certification. M0 must run a pinned full OpenAPI validator and actual TypeScript client generation before freezing the contract. No Laravel application, browser integration, provider credentials, real payments or concurrency behaviour were executed; their acceptance checks are specified in the implementation plan. No effort estimate is a delivery commitment.
