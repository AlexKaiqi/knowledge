# OpenConnector public social search candidate

This hidden Connector is a deliberately narrow adapter over the OpenConnector v1 Action runtime. It exposes no OKF knowledge and is not automatically routable.

The candidate currently permits exactly one first-page, read-only keyword search on Xiaohongshu or Douyin through the TikHub provider. It does not install OpenConnector, create an OOMOL/TikHub account, accept terms, configure credentials, retry, paginate, download media or perform a platform write.

The returned `upstreamPayload` is an ephemeral internal handoff only. It may contain public account identifiers supplied by the upstream and must not enter logs, Git or an OKF result. A capability-specific deidentifying projection can be defined only after the live probe establishes the real response shape and content-use boundary.

Before a live probe, an operator must separately approve the provider account and terms, platform-content use, TikHub spend, an encrypted self-hosted OpenConnector data directory, a connection-scoped runtime token, and the fixed probe query.
