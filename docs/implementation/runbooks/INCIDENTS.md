# Incidents and background services

Check `/up` for process liveness and `/ready` for dependencies/configuration. The scheduler writes a Redis heartbeat and queues a worker heartbeat once per minute; enabling REQUIRE_BACKGROUND_HEALTH makes stale/missing heartbeats fail readiness. Restart supervised queue workers and scheduler with the matching release after deployments. Multiple scheduler instances use Redis singleton/overlap locks.

Use `php artisan queue:failed` and application logs that record exception type/request ID without customer payloads. Inspect private database/provider details only with operator authorization. Configure external alerts for failed jobs, pending outbox/inbox age, payment unknown/exception age, overdue quotes/reviews, low inventory and backup failures. The application supplies records and health signals; hosting alert delivery is not configured automatically.

A queue outage does not erase webhook events/outbox intents. Restore Redis/worker availability, allow the scheduler sweep to replay, and reconcile received funds before retrying a financial operation. Expiry releases unpaid holds once; a capture arriving after release stays a financial exception and never silently resurrects stock.

For a security incident, close intake, revoke affected staff sessions/memberships and secrets, preserve audit/provider evidence, and investigate scope before recovery. Never paste secrets or full proof/customer payloads into logs or chat. Restore from a known private backup only after checking it and reconciling external financial facts.
