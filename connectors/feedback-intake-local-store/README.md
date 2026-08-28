# Feedback intake local store connector

Persists one verified `Consented Feedback Intake Review Revision` into a configured user-controlled local store and returns a schema-bound receipt. Public input never selects a filesystem path and never supplies an `approved` boolean. The Host must resolve the immutable revision and verify a trusted, exact-binding review grant.

The implementation uses one content-checked envelope per opaque submission slot, an exclusive temporary file, file sync and an atomic hard-link commit. Exact idempotent replay returns the accepted receipt; another revision or idempotency key for the same submission fails closed. Withdrawal and deletion are intentionally separate capabilities.
