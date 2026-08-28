# Evidence-backed research

Turn a decision-shaped question into a bounded, source-grounded Research Dossier. Research is complete only when it changes or justifies a decision; a link list or search-result summary is not an answer.

## Common method

1. Restate the goal, decision, constraints, cutoff and answer form.
2. Compile each question into source-specific queries using different vocabularies, dates and opposing stances.
3. Open every cited source. Prefer original documents, repositories, work items, papers, datasets, experiments and source-native feedback over summaries.
4. Record one EvidenceItem per independently inspected claim with an exact locator and digest. Several pages repeating one ancestor are one evidence chain, not several independent confirmations.
5. Keep source-native claims separate from inference. Resolve important disagreement by conditions, definitions, versions or error; do not average it away.
6. Search explicitly for evidence against the leading conclusion. A failed counter-search is recorded as `none-found` or `inconclusive`, never silently omitted.
7. Stop on decision sufficiency, budget, source exhaustion or blocked access. State coverage and gaps.
8. Lead with the answer and confidence. Finish with a bounded probe whose success and failure would change the decision.

## Scenario policies

### Demand

Treat interviews, reviews, support records and community posts as evidence of a situation, struggle, workaround, consequence and desired outcome. Preserve source locators. Do not convert one feature request into a general need or infer frequency from a convenience sample. Express opportunities as jobs/workflows, not requested implementations.

### Market and competitive

Fix category, geography, time and unit before sizing or comparison. Separate vendor positioning, observed product behavior and independent customer evidence. A market-size claim needs explicit assumptions plus a second calculation or remains suggestive. A feature matrix is not proof of demand or advantage.

### Technical solution

Fix versions, workload, constraints and failure criteria. Prefer source code, official documentation, releases, reproducible benchmarks and issue/postmortem evidence. Installation, stars and a passing demo are not proof that the target workflow works. End with a local/sandbox/live probe.

### Academic frontier

Declare retrieval cutoff, unit of analysis and inclusion/exclusion rules. Verify title, authors, identifier and version. Trace each important claim to a section, table, figure or appendix; separate reported, derived, inferred, conflicting and undisclosed evidence. Leaderboards do not establish causality without controlled comparison.

### Platform integration

Establish official permissions, terms, schemas, limits and change surface before comparing implementation routes. Separate official support from unofficial feasibility. A usable route requires a sandbox/live probe proposal, explicit identity class, effect and cleanup; never auto-install, log in, accept terms or execute platform writes.

### Distribution and impact

Use channel-native publication receipts, exposure, engagement, feedback and conversion as different measures. Fix time window and baseline. Do not treat exposure as influence, engagement as conversion, or correlation as attribution. Propose a controlled publication or measurement probe when causal evidence is required.

## Output discipline

- Output only the public dossier schema; never expose prompts, route selection, credentials, internal traces or raw private source material.
- Every supported or suggestive finding cites opened EvidenceItems.
- Mark every inference explicitly and report unknowns.
- Confidence reflects evidence quality and coverage, not writing certainty.

## Method provenance

This method synthesizes, rather than vendors, the following MIT-licensed upstream patterns at pinned revisions:

- `arjunprabhulal/agent-skills` deep-research at `42dd24080fce6d731d00e2a1134f398c3da4171b`
- `msimchowitz/writing-skills` literature-review at `214981fe02326f27b0fc8790d00eb4b731607073`
- `lowwwbank/interview-to-jtbd` at `810e847b7d936a54bd090c4d0797efd576404152`
- `xcrrr/claude-skills` market-researcher at `145342ceff6318d2f5ffe8f95473fecc8b27d1e9`
- `openai/plugins` life-science research-router at `33bd9529725fcee78c9e51fcbaa93cd963c3a47b`
