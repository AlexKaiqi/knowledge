# Public-state pet behavior projector

Hidden deterministic Connector for `/capabilities/pet/project-public-state-to-behavior.md`.

It accepts only bounded public Session snapshots and public Pet Assistant lifecycle states. It never accepts transcript text, prompts, tool arguments, hidden reasoning, credentials or provider state. The output is a renderer-neutral baseline and optional one-shot PetAction pulse.

The state vocabulary and edge semantics were adapted from the production `dsh-codex-pet` client at commit `ddacb3e40385db280930e93d350d3706a8656518` (MIT). Character C0 experiments and uncommitted workspace changes are explicitly outside this Connector.
