# Appfigures public app reviews candidate

This non-routable candidate implements a bounded competitor review snapshot for Apple App Store and Google Play. Callers use the store-native Apple ID or package name; the Connector resolves and hides the provider-assigned product ID before making one newest-first `/reviews` request.

The invocation cannot select a provider endpoint, request author filtering, translate reviews, read replies, page beyond the first 25 reviews, or retain author identity. Apple territory and Google Play's country-unavailable `ZZ` semantics remain distinct. The public projection also discards the provider's unreliable `has_response` field for competitor apps.

The route requires an approved internal-use account, Personal Access Token, Public Data API add-on and credits. Its expected upper bound is five credits per invocation: two for product metadata and three for reviews. Actual credits must be reconciled in the provider account because the endpoint response does not report them.

Promotion requires a live probe, a reviewed commercial-use determination, an opaque identity/pool, public Schema admission and human review. Standard access is not sufficient for public data resale, client processing, a commercial data product or AI training.
