---
title: "Paper VN Entity Filters and Unified Search Sprint"
kind: "sprint"
created_at: "2026-06-29T07:18:34.420Z"
source: "repo-harness-mcp"
---
# Paper VN Entity Filters and Unified Search Sprint

> **Status**: Executing

## Source

- PRD: `plans/prds/20260629-1416-paper-vn-entity-filters-unified-search.prd.md`

## Execution Rule

- Execute task cards in order.
- Keep each task card reviewable as one staged slice.
- After every completed phase, update the checklist and stage the result before continuing.
- Do not treat unstaged work as a completed phase.

## Checklist

### Task Card 1: BE-01 — Baseline and contract audit

- [x] Objective: Read current handoff, current article filter/search/analytics code, run targeted baseline tests, and document current request/response shapes before editing.
- [x] Files/entrypoints: `.ai/harness/handoff/current.md`, `src/services/articleFilter.service.js`, `src/services/article.service.js`, `src/controllers/article.controller.js`, `src/routes/article.route.js`
- [x] Verification: `Record current branch/worktree state`, `Run focused article filter and Paper VN discovery tests`, `Confirm existing analytics and list response shapes`
- [x] Stage gate: Stage only workflow notes or baseline test updates before moving on.

Baseline note: branch `hao/refactor/BE`; focused baseline passed with `node --test src/tests/unit/service/article.test.js src/tests/unit/service/articleFilter.test.js src/tests/unit/service/paperVnDiscovery.test.js` (24/24). Existing list accepts search/title DOI abstract plus prior filters; analytics shares `buildArticleFilter`; VN scope still needed Author soft-delete enforcement before BE-03.

### Task Card 2: BE-02 — Extend reusable entity filters

- [x] Objective: Add validated publisherId, authorId and keywordId support to the shared article filter builder so list, count, stats and analytics automatically inherit them.
- [x] Files/entrypoints: `src/services/articleFilter.service.js`, `src/controllers/article.controller.js`
- [x] Verification: `Validate positive numeric IDs`, `Use EXISTS for author/keyword filters to avoid duplicate rows`, `Use journal publisher_id for publisher filter`, `Unit tests cover each new filter`
- [x] Stage gate: Stage shared filter and controller changes only after focused tests pass.

### Task Card 3: BE-03 — Fix VN scope soft-delete semantics

- [x] Objective: Join Author in the vn_universities scope predicate and exclude soft-deleted authors while preserving exact-year affiliation.
- [x] Files/entrypoints: `src/services/articleFilter.service.js`, `src/tests/unit/service/articleFilter.test.js`
- [x] Verification: `Scope SQL includes Author join`, `Author.is_deleted=false is enforced`, `Exact-year Institution_Author condition remains`
- [x] Stage gate: Stage scope fix and tests separately.

### Task Card 4: BE-04 — Implement unified search

- [x] Objective: Expand /articles?search= across title, abstract, DOI, journal name, ISSN, publisher name, author name, keyword and topic while preserving full metadata and pagination.
- [x] Files/entrypoints: `src/services/articleFilter.service.js`, `src/services/article.service.js`
- [x] Verification: `Use EXISTS/subqueries for many-to-many search sources`, `No duplicate article rows`, `Search and count use identical predicate`, `Full card metadata remains present`
- [x] Stage gate: Stage unified search after representative search tests pass.

### Task Card 5: BE-05 — Normalize analytics contract

- [x] Objective: Return stable analytics fields for publishers, authors, topics and access distribution so FE does not need alias guessing.
- [x] Files/entrypoints: `src/services/article.service.js`, `src/controllers/article.controller.js`
- [x] Verification: `topPublishers items expose publisher_id, display_name, article_count`, `topAuthors items expose author_id, display_name, article_count`, `topTopics items expose topic_id, display_name, article_count`, `accessDistribution is an array with key, label and count`, `Unknown/null entities are either excluded or explicitly marked non-filterable`
- [x] Stage gate: Stage analytics contract with response-shape tests.

### Task Card 6: BE-06 — Keep fallback endpoints compatible

- [x] Objective: If keyword/topic endpoints remain, make them return the same article summary shape as /articles and keep scope/sort behavior consistent.
- [x] Files/entrypoints: `src/services/keyword.service.js`, `src/controllers/keyword.controller.js`, `src/services/topic.service.js`, `src/controllers/topic.controller.js`
- [x] Verification: `Remove hard-coded citations_count=0`, `Return authors, journal, publisher, volume, issue, OA, citation and reference counts`, `Pagination totals respect scope`
- [x] Stage gate: Stage fallback compatibility separately; do not remove endpoints.

### Task Card 7: BE-07 — Documentation and verification

- [x] Objective: Update API contract and handoff, then run focused and full available checks without touching core Trending VN.
- [x] Files/entrypoints: `docs/researches/paper-vn-discovery-api-contract.md`, `.ai/harness/handoff/current.md`
- [x] Verification: `Document publisher_id, author_id, keyword_id`, `Document unified search sources`, `Document normalized analytics shape`, `Run focused tests and available full suite`, `Confirm core /trending-vn files unchanged`
- [x] Stage gate: Final stage contains docs, tests and handoff only.

## Final Acceptance

- [x] All task cards are checked.
- [x] Required focused checks pass; full suite attempted and documented with pre-existing unrelated failures.
- [x] Handoff explains staged state, residual risks, and next bottleneck if any.
