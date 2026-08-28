# feedback-intake-local-withdrawal

Hidden local-write Connector for `feedback.withdraw-consented-intake-record`.

It resolves an exact existing storage receipt inside a configured user-controlled store, verifies a trusted withdrawal grant bound to the receipt and mechanism, persists a recovery journal, removes the private record, synchronizes the directory, and commits a bounded withdrawal receipt. Public input cannot select a filesystem path or self-declare approval.

The receipt proves logical removal from this store only. It does not claim media sanitization, backup purge, downstream-copy deletion, platform reply, or any further authority.
