---
title: "Paper VN Trending Analysis API Sprint"
kind: "sprint"
created_at: "2026-06-29T20:23:30.762Z"
source: "repo-harness-mcp"
---
# Paper VN Trending Analysis API Sprint

> **Status**: Draft

## Source

- PRD: `plans/prds/20260630-0323-paper-vn-trending-analysis-api.prd.md`

## Execution Rule

- Execute task cards in order.
- Keep each task card reviewable as one staged slice.
- After every completed phase, update the checklist and stage the result before continuing.
- Do not treat unstaged work as a completed phase.

## Checklist

### Task Card 1: BE-TREND-01 — Baseline, branch safety and contract-first tests

- [x] Objective: Confirm branch hao/refactor/BE and preserve the dirty worktree. Read articleFilter, article service/controller/routes, legacy trendingVn files, schema references and existing tests. Add failing contract tests for Article-level OA semantics, analysis route ordering, default/explicit windows and the planned response shape before implementation.
- [ ] Files/entrypoints: `src/services/articleFilter.service.js`, `src/services/article.service.js`, `src/controllers/article.controller.js`, `src/routes/article.route.js`, `src/services/trendingVn.service.js`, `src/tests/unit/service/article.test.js`, `src/tests/unit/service/articleFilter.test.js`
- [ ] Verification: `Confirm current branch is hao/refactor/BE`, `Record git status --short`, `Run existing focused article tests`, `Demonstrate new tests fail for expected missing/incorrect behavior`, `Do not contact production DB in automated tests`
- [ ] Stage gate: Stage only baseline evidence and failing regression/contract tests.

### Task Card 2: BE-TREND-02 — Correct Article open-access semantics

- [x] Objective: Change article discovery and analytics to use Article.is_open_access as the source of truth. OA means IS TRUE, closed means IS FALSE, and null remains unavailable. Update list projection, list stats and lightweight analytics without breaking shared filter alignment.
- [ ] Files/entrypoints: `src/services/articleFilter.service.js`, `src/services/article.service.js`, `src/tests/unit/service/articleFilter.test.js`, `src/tests/unit/service/article.test.js`, `docs/researches/paper-vn-discovery-api-contract.md`
- [ ] Verification: `buildArticleFilter uses article alias for access predicates`, `closed does not include null`, `getAllArticles projects a.is_open_access`, `getArticleListStats counts OA from Article`, `lightweight analytics returns open, closed and unknown counts`, `List/count/stats/analytics remain filter-consistent`
- [ ] Stage gate: Stage OA corrections after focused filter/article tests pass.

### Task Card 3: BE-TREND-03 — Resolve analysis windows and filtered cohort

- [x] Objective: Add validated analysis window parsing and a reusable filtered cohort builder. All non-year discovery filters use buildArticleFilter. publication_year maps to a single-year current window only when explicit from/to are absent. Default current window is the latest two publication years in the filtered cohort, with an immediately preceding equal-length comparison window.
- [ ] Files/entrypoints: `src/services/articleAnalysis.service.js`, `src/services/articleFilter.service.js`, `src/controllers/article.controller.js`, `src/tests/unit/service/articleAnalysis.test.js`
- [ ] Verification: `Validate integer years and from<=to`, `Reject partial current window pairs`, `Derive comparison window with equal length`, `Default uses max publication year from the filtered cohort`, `publication_year maps to current single year plus previous-year comparison`, `Search/entity/access/scope filters are preserved without applying publication year twice`, `Empty cohort returns a stable empty window/response`
- [ ] Stage gate: Stage window/cohort implementation after deterministic unit tests pass.

### Task Card 4: BE-TREND-04 — Implement summary and time-series contract

- [x] Objective: Implement GET /articles/analysis summary, works_over_time and citations_over_time. Summary uses imported Article counts for total citations/references and separately reports available citing/reference relation rows. Citation history is aggregated only from valid citations_by_year JSON keys and includes coverage metadata.
- [ ] Files/entrypoints: `src/services/articleAnalysis.service.js`, `src/controllers/article.controller.js`, `src/routes/article.route.js`, `src/tests/unit/service/articleAnalysis.test.js`
- [ ] Verification: `Summary returns scholarly_works, total_citations, total_references, available_citing_works, available_references, authors, institutions, journals, open_access_works and oa_unavailable_works`, `Works series covers comparison_from_year through to_year with zero-filled missing years`, `Citation series ignores invalid JSON keys and missing histories rather than treating them as zero`, `Citation series returns coverage_articles and total_articles_with_history`, `Relation counts are labeled available and never substituted for imported totals`, `Route /analysis is declared before /:id`
- [ ] Stage gate: Stage summary/time-series endpoint after service/controller/route tests pass.

### Task Card 5: BE-TREND-05 — Implement exact-year entity ranking and growth

- [x] Objective: Return top/growth institutions, authors, journals, topics and keywords for current versus comparison windows. Count distinct articles, dedupe many-to-many relations and return stable IDs/names plus current_count, previous_count, absolute_growth and nullable growth_rate.
- [ ] Files/entrypoints: `src/services/articleAnalysis.service.js`, `src/tests/unit/service/articleAnalysis.test.js`, `docs/researches/paper-vn-trending-analysis-api-contract.md`
- [ ] Verification: `Institutions use Institution_Author.year = Article.publication_year`, `vn_universities institution ranking includes only VN education institutions`, `No last_known_institution usage`, `Authors count distinct article-author pairs`, `Journals count distinct articles through Issue→Volume→Journal`, `Topics union primary_topic and Sub_Topic without double-counting`, `Keywords use Keyword_Article without double-counting`, `growth_rate is null when previous_count=0 and current_count>0 unless contract documents another explicit value`, `Stable deterministic ordering and limits`
- [ ] Stage gate: Stage entity ranking/growth after SQL-shape and result-contract tests pass.

### Task Card 6: BE-TREND-06 — Implement honest trending article ranking

- [x] Objective: Return trending_articles using only articles with usable citations_by_year. Compute current-window citation activity, comparison-window citation activity, absolute growth and nullable growth rate. Do not fabricate scores or fall back silently to relation counts.
- [ ] Files/entrypoints: `src/services/articleAnalysis.service.js`, `src/tests/unit/service/articleAnalysis.test.js`, `docs/researches/paper-vn-trending-analysis-api-contract.md`
- [ ] Verification: `Only valid citation-history articles are eligible`, `Current and previous citation sums use requested windows`, `Missing citation history remains unavailable`, `Tie-breaking is deterministic`, `Rows include article_id, title, publication_year, journal metadata, citation_count, reference_count, current_citations, previous_citations, absolute_growth and growth_rate`, `Contract exposes trending_article_coverage`
- [ ] Stage gate: Stage trending article query after focused ranking/coverage tests pass.

### Task Card 7: BE-TREND-07 — Lightweight analytics compatibility, verification and handoff

- [x] Objective: Extend/fix /articles/analytics for the list/sidebar with canonical year/access shapes, totals and exact-year top institutions while preserving existing fields where practical. Document the new heavy endpoint, run focused checks, attempt the full suite, and update handoff without commit/push.
- [ ] Files/entrypoints: `src/services/article.service.js`, `src/controllers/article.controller.js`, `src/routes/article.route.js`, `src/tests/unit/service/article.test.js`, `src/tests/unit/service/articleAnalysis.test.js`, `docs/researches/paper-vn-discovery-api-contract.md`, `docs/researches/paper-vn-trending-analysis-api-contract.md`, `.ai/harness/handoff/current.md`, `.ai/harness/checks/latest.json`
- [ ] Verification: `Light analytics remains fast and filter-aligned`, `yearDistribution exposes canonical year/count values`, `accessDistribution exposes key/label/count and unknown`, `topInstitutions uses exact-year affiliation`, `node --check passes for changed files`, `Focused article/filter/analysis tests pass`, `npm.cmd test is attempted and unrelated failures documented exactly`, `git diff --cached --check passes`, `No migration, production write, commit or push`
- [ ] Stage gate: Stage final docs and handoff only after verification evidence is recorded.

## Final Acceptance

- [x] All task cards are checked.
- [x] Required checks pass.
- [x] Handoff explains staged state, residual risks, and next bottleneck if any.
