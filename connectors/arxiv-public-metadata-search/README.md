# arxiv-public-metadata-search

Hidden deterministic Connector for the public arXiv legacy Metadata API. It accepts a bounded phrase/category query, performs one serial request to the fixed Atom endpoint, and returns normalized descriptive metadata.

It does not download PDFs/source files, submit papers, retry failures, execute arbitrary arXiv query syntax, or expose the internal request route through the public capability result. A process-local gate enforces at least three seconds between request starts.
