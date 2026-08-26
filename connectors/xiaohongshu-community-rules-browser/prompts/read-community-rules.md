# Read community rule surface

Open only the configured official source URL in a read-only browser. Extract the rendered page title, the displayed publication timestamp, all article `h1` headings, and all article `h3` rule headings. Do not click support/chat controls, log in, submit forms, or read browser storage.

Pass the exact extracted strings and observation time to `readCommunityRuleSurface`. Return only its normalized result. Never return raw HTML, paragraphs, navigation labels, cookies, account state, or browser metadata.
