# Current work projection maintainer Connector

This hidden hybrid Connector binds an opaque current Session and Workspace to the production Personal Knowledge Base maintainer. The runtime resolves real paths, reads only unconsumed Session events, serializes model calls, updates the rebuildable current projection and may create at most four unconfirmed durable-knowledge proposals.

The public operation never accepts raw transcript, cwd, cursor, model route, proposed Markdown, confirmation or authority. It returns only mutation facts and opaque proposal references. It cannot apply a proposal, modify durable Markdown, commit Git or authorize another action.
