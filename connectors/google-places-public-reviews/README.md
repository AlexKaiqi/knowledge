# Google Places public reviews candidate

This hidden candidate resolves one place through Text Search (New) using the ID-only field mask, then reads one Place Details (New) response containing at most five relevance-selected reviews.

The result is deliberately an **ephemeral attributed observation**, not a durable review dataset. Google requires author attribution and a direct Google Maps link whenever a review is displayed, while Places content caching and storage are restricted. The operation therefore retains the complete attribution bundle only for the active invocation, forbids identity graphs and durable provider content, and supplies a separate verification redaction that contains no place name, address, review text, author, review URI, place ID, rating or publish time.

A Research Dossier may keep deidentified paraphrases and evidence references created during the invocation only after product/legal review; it must not copy the provider review, author attribution or a provider-content digest into Git.

The Connector is not routable until the Google Cloud project, Places API (New), billing, key restrictions, public Terms/Privacy and attribution UI are approved and the live probe passes.
