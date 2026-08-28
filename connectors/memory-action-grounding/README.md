# Memory-to-action grounding

Hidden deterministic Connector for `/capabilities/assistant/ground-memory-into-action-candidate.md`.

It binds only field-addressed, active, non-stale, authoritative memory claims to a bounded flat action contract. Explicit-only fields are never filled from memory. Conflicts, stale claims, inferred claims and wrong-scope claims remain unresolved. The result is always an unexecuted candidate and never an authorization receipt.

This Connector does not parse personal Markdown, retrieve memories, call an Agent, invoke a tool or mutate durable knowledge. Those are separate capabilities and effects.
