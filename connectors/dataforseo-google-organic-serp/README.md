# DataForSEO Google Organic SERP candidate

This Connector is a non-routable candidate for the future `/capabilities/research/read-web-result-page.md` contract. It implements one bounded Google Organic page through fixed DataForSEO sandbox or production hosts.

The public input cannot select an endpoint, add raw search parameters, request more than ten organic results, enable AI overview/pixel/crawl features, or use advanced operators whose provider price is multiplied. Credentials are injected through the `api-basic` slot and never accepted in the invocation payload.

Sandbox proves only authentication and response-shape compatibility because the provider returns dummy results. Promotion requires the production live probe, actual billing reconciliation, a reviewed provider identity/contract, and a canonical Capability/Schema admission in the same approved revision. Until then this directory cannot be selected by the Capability Gateway.
