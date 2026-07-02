---
title: "Lens-Style Article Detail Data Sprint"
kind: "sprint"
created_at: "2026-06-29T13:43:46.942Z"
source: "repo-harness-mcp"
---
# Lens-Style Article Detail Data Sprint

> **Status**: Draft

## Source

- PRD: `plans/prds/20260629-2040-lens-style-article-detail-data-institution-analytics.prd.md`

## Execution Rule

- Execute task cards in order.
- Keep each task card reviewable as one staged slice.
- After every completed phase, update the checklist and stage the result before continuing.
- Do not treat unstaged work as a completed phase.

## Checklist

### Task Card 1: BE-01 — Audit current data

- [ ] Objective: Inspect schema and current article detail APIs before editing.
- [ ] Files/entrypoints: `src/services/article.service.js`, `src/controllers/article.controller.js`, `src/routes/article.route.js`
- [ ] Verification: `Record baseline tests`, `Confirm which publication, page, identifier and link fields exist`, `Do not fabricate missing fields`
- [ ] Stage gate: Stage audit notes only.

### Task Card 2: BE-02 — Resolve filter labels

- [ ] Objective: Add one endpoint that resolves journal, publisher, author, topic, keyword and institution IDs to display names.
- [ ] Files/entrypoints: `src/routes/article.route.js`, `src/controllers/article.controller.js`, `src/services/article.service.js`
- [ ] Verification: `Declare route before /:id`, `Validate positive IDs`, `Return id, display_name and found`, `Test mixed and missing IDs`
- [ ] Stage gate: Stage resolver and tests.

### Task Card 3: BE-03 — Add author affiliations

- [ ] Objective: Return author institutions at Article.publication_year and a deduplicated article institutions list.
- [ ] Files/entrypoints: `src/services/article.service.js`
- [ ] Verification: `Use Author_Article, Institution_Author and Institution`, `Match publication year`, `Exclude deleted records`, `Return deterministic institution numbering data`
- [ ] Stage gate: Stage affiliation work and tests.

### Task Card 4: BE-04 — Separate count meanings

- [ ] Objective: Keep citation/reference metrics separate from locally available citing-work/reference records.
- [ ] Files/entrypoints: `src/services/article.service.js`, `src/controllers/article.controller.js`
- [ ] Verification: `Return citation_count and reference_count`, `Return available_citing_works_count and available_references_count`, `Test mismatched values`
- [ ] Stage gate: Stage count contract and tests.

### Task Card 5: BE-05 — Add citing-year analytics

- [ ] Objective: Return citing works grouped by publication year for the detail sidebar.
- [ ] Files/entrypoints: `src/services/article.service.js`, `src/controllers/article.controller.js`, `src/routes/article.route.js`
- [ ] Verification: `Aggregate all matching rows`, `Sort by year`, `Do not depend on pagination`, `Test empty and populated data`
- [ ] Stage gate: Stage chart API and tests.

### Task Card 6: BE-06 — Add institution filtering and analytics

- [ ] Objective: Support institution_id in discovery and return Top Vietnamese Institutions.
- [ ] Files/entrypoints: `src/services/articleFilter.service.js`, `src/controllers/article.controller.js`, `src/services/article.service.js`
- [ ] Verification: `Apply to list, count, stats and analytics`, `Use publication-time affiliation`, `Return institution_id, display_name, image_url and article_count`, `Prevent duplicate article counts`
- [ ] Stage gate: Stage institution filter and tests.

### Task Card 7: BE-07 — Normalize detail metadata

- [ ] Objective: Return truthful publication metadata, identifiers and source links without duplicates.
- [ ] Files/entrypoints: `src/services/article.service.js`, `docs/researches/paper-vn-discovery-api-contract.md`
- [ ] Verification: `Return only real fields`, `Document unavailable fields`, `Do not relabel internal IDs as external IDs`
- [ ] Stage gate: Stage contract docs.

### Task Card 8: BE-08 — Verify and hand off

- [ ] Objective: Run tests and publish final examples for FE.
- [ ] Files/entrypoints: `.ai/harness/handoff/current.md`
- [ ] Verification: `Run focused and full available tests`, `Provide response examples`, `Confirm core Trending VN unchanged`, `Do not auto-commit`
- [ ] Stage gate: Final docs and handoff only.

## Final Acceptance

- [ ] All task cards are checked.
- [ ] Required checks pass.
- [ ] Handoff explains staged state, residual risks, and next bottleneck if any.
