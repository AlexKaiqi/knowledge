# Durable memory change review revision

Hidden deterministic Connector for `/capabilities/assistant/prepare-durable-memory-change-review-revision.md`.

It normalizes one `USER.md` or direct `knowledge/*.md` upsert/delete, binds the exact base/current/desired content digests and provenance into an immutable human-review revision, detects target conflicts and idempotent replay, and never creates a proposal, writes a file, commits Git or issues a receipt.
