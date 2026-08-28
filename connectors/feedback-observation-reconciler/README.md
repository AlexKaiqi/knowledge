# feedback-observation-reconciler

Hidden deterministic Connector for `/capabilities/feedback/reconcile-feedback-observations.md`.

It compares two bounded, already deidentified feedback observation windows using opaque item refs, semantic digests, explicit lifecycle observations, and coarse reply state. It never receives feedback text or people fields, never infers deletion from absence, and never advances a source checkpoint itself.
