# Apple public app catalog search

This verified Connector maps the public `research.search-public-app-catalog` capability to Apple's documented iTunes Search API. The public contract accepts a plain query, App Store country, `iphone|ipad|mac` surface and a maximum of 25 results. The Connector fixes the endpoint, media/entity, explicit-content flag and response version; callers cannot inject an endpoint or arbitrary Apple parameters.

The projection retains only store-native app identity, company/developer name, genre, version dates, price, rating summary and a canonical App Store URL. It removes descriptions, release notes, artwork, support/developer URLs, device lists, raw JSON and Apple request headers. Returned order is preserved but explicitly has unspecified ranking semantics, and `resultCount` is only the returned page size—not corpus size, demand, rank share or a stable checkpoint.

Apple's official documentation is in the Documentation Archive and states an approximate 20-call-per-minute limit. The implementation makes one request per invocation, serializes requests with a three-second minimum interval and never retries. It uses the documented Search API, not App Store HTML scraping or the undocumented customer-review RSS endpoint.
