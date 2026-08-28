# feedback-intake-local-retention-expiry

Hidden local-write Connector for `feedback.expire-consented-intake-record`.

It resolves an exact existing storage receipt, verifies the immutable retention policy and deadline, refuses early deletion, and requires a trusted cleanup grant that explicitly reports `disposition=delete` and `holdStatus=clear`. A durable journal makes the exact deletion recoverable and idempotent.

The result proves logical removal from the configured store after the recorded deadline. It does not claim user withdrawal, legal compliance, media sanitization, backup purge, downstream-copy deletion, or automatic scheduling.
