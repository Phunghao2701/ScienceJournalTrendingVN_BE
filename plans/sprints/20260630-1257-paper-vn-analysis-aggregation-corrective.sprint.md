---
title: "Paper VN Analysis Aggregation Corrective Sprint"
kind: "sprint"
created_at: "2026-06-30T05:57:25.869Z"
source: "repo-harness-mcp"
---
# Paper VN Analysis Aggregation Corrective Sprint

> **Status**: Executing

## Source

- PRD: `plans/prds/20260630-1256-paper-vn-analysis-aggregation-corrective.prd.md`

## Execution Rule

- Execute task cards in order.
- Keep each task card reviewable as one staged slice.
- After every completed phase, update the checklist and stage the result before continuing.
- Do not treat unstaged work as a completed phase.

## Checklist

### Task Card 1: BE-FIX-01 — Baseline and failing regression tests

- [x] Objective: Confirm branch hao/refactor/BE, preserve the dirty/staged worktree, and add focused tests that demonstrate the current fan-out, relation-count, ranking, coverage and window-safety defects before changing production code.
- [x] Files/entrypoints: `src/services/articleAnalysis.service.js`, `src/tests/unit/service/articleAnalysis.test.js`, `src/tests/unit/service/articleFilter.test.js`, `.ai/harness/handoff/current.md`
- [x] Verification: `Confirm branch hao/refactor/BE`, `Record git status --short`, `Run current focused analysis tests`, `Add failing tests or SQL-shape assertions for summary pre-aggregation, composite relation keys, distinct top/growth ordering, stable citation coverage, shared trending eligibility, soft-delete handling and maximum window length`, `No live DB/network access in automated tests`
- [x] Stage gate: Stage only regression tests and baseline evidence after the new tests fail for the expected reasons.

Evidence:

- Branch confirmed: `hao/refactor/BE`.
- Baseline `git status --short` recorded pre-existing staged/dirty work and untracked harness files; no unrelated files were reverted.
- `node --test src/tests/unit/service/articleAnalysis.test.js` failed as expected after new regression assertions: 6 pass, 4 fail. Failures cover missing summary pre-aggregation/composite relation CTEs, shared top/growth array reference, zero-filled citation coverage denominator reset to 0, and coverage SQL using a current publication-year filter instead of the trending eligible cohort.

### Task Card 2: BE-FIX-02 — Remove summary fan-out and correct relation counts

- [x] Objective: Rewrite summary aggregation so Article citation/reference totals are summed once per current-window article. Pre-aggregate article totals, relation-row coverage, valid authors and exact-year institutions independently, then combine one-row aggregates. Count relation rows by their composite keys or deduped CTE rows.
- [x] Files/entrypoints: `src/services/articleAnalysis.service.js`, `src/tests/unit/service/articleAnalysis.test.js`
- [x] Verification: `No SUM(citation_count/reference_count) occurs after joins to many-to-many relation tables`, `Article totals are computed from current_articles alone`, `available_citing_works counts distinct article_id/openalex_work_id pairs`, `available_references counts distinct article_id/reference_key pairs`, `authors counts filtered au.author_id, not aa.author_id`, `institutions are linked through valid non-deleted authors and exact publication year`, `vn_universities institution summary remains restricted to VN education`
- [x] Stage gate: Stage summary SQL changes after focused fan-out and relation-count tests pass.

Evidence:

- `node --test --test-name-pattern "pre-aggregated summary" src/tests/unit/service/articleAnalysis.test.js` passed 1/1 after summary CTE rewrite.

### Task Card 3: BE-FIX-03 — Separate top and growth ranking

- [x] Objective: Generate independent top and growth arrays for institutions, authors, journals, topics and keywords. Reuse the same deduplicated relation/count CTE where practical, but apply distinct deterministic ordering and limits.
- [x] Files/entrypoints: `src/services/articleAnalysis.service.js`, `src/tests/unit/service/articleAnalysis.test.js`, `docs/researches/paper-vn-trending-analysis-api-contract.md`
- [x] Verification: `top sorts by current_count DESC, then absolute_growth DESC, then display_name`, `growth sorts by absolute_growth DESC, then current_count DESC, then display_name`, `top and growth are independently mapped arrays, not the same object reference`, `growth_rate remains nullable when previous_count=0`, `Contract states growth_rate is a decimal ratio where 1.0 means 100%`
- [x] Stage gate: Stage entity ranking changes after top/growth regression tests pass.

Evidence:

- `node --test --test-name-pattern "independently ranked" src/tests/unit/service/articleAnalysis.test.js` passed 1/1 after splitting top and growth entity queries.

### Task Card 4: BE-FIX-04 — Correct citation and trending coverage semantics

- [x] Objective: Keep citation-history coverage stable for every zero-filled year and make trending_article_coverage use the same eligible cohort and valid-history/window semantics as trending_articles.
- [x] Files/entrypoints: `src/services/articleAnalysis.service.js`, `src/tests/unit/service/articleAnalysis.test.js`, `docs/researches/paper-vn-trending-analysis-api-contract.md`
- [x] Verification: `total_articles_with_history is computed once for the filtered cohort and copied to every citations_over_time row`, `A year with zero citations still reports the correct total_articles_with_history`, `Invalid JSON keys/values remain excluded`, `Trending eligible_articles uses the same valid citation-history CTE as trending_articles`, `Trending coverage does not add a publication_year filter absent from the trending list`, `Coverage total_articles is clearly documented as the discovery cohort denominator`, `Tests cover an older article receiving citations in the current window`
- [x] Stage gate: Stage coverage changes after focused zero-fill and eligibility tests pass.

Evidence:

- `node --test --test-name-pattern "coverage" src/tests/unit/service/articleAnalysis.test.js` passed 2/2 after citation year-series and trending coverage CTE changes.

### Task Card 5: BE-FIX-05 — Add public window safety validation

- [x] Objective: Validate analysis years and cap the maximum inclusive window length before building year arrays or executing queries. Keep comparison windows deterministic and return the existing INVALID_ANALYSIS_WINDOW error code.
- [x] Files/entrypoints: `src/services/articleAnalysis.service.js`, `src/tests/unit/service/articleAnalysis.test.js`, `docs/researches/paper-vn-trending-analysis-api-contract.md`
- [x] Verification: `Years are constrained to a documented reasonable range such as 1800 through current year plus one`, `Current window has a documented maximum inclusive length, recommended 25 years`, `Huge, negative, non-integer, reversed and partial windows return 400 semantics`, `buildYears cannot allocate an unbounded array`, `Default and publication_year modes still work`
- [x] Stage gate: Stage validation changes after boundary and denial-of-service regression tests pass.

Evidence:

- `node --test --test-name-pattern "resolveAnalysisWindows" src/tests/unit/service/articleAnalysis.test.js` passed 5/5 with explicit bounds and maximum-window tests.

### Task Card 6: BE-FIX-06 — Verification, read-only Supabase smoke and closeout

- [x] Objective: Run syntax and focused tests, attempt the full suite, then perform read-only smoke calls/queries against the configured Supabase environment. Compare summary totals with independent read-only SQL for the same scope/window. Update docs, sprint, handoff and checks with exact evidence. Do not write production data, commit or push.
- [x] Files/entrypoints: `src/services/articleAnalysis.service.js`, `src/tests/unit/service/articleAnalysis.test.js`, `docs/researches/paper-vn-trending-analysis-api-contract.md`, `plans/sprints/20260630-1257-paper-vn-analysis-aggregation-corrective.sprint.md`, `.ai/harness/handoff/current.md`, `.ai/harness/checks/latest.json`
- [x] Verification: `node --check passes for changed service/controller/route files`, `Focused article/filter/analysis tests pass`, `npm.cmd test is attempted and unrelated failures documented exactly`, `Read-only smoke GET /api/v1/articles/analysis?scope=vn_universities succeeds or equivalent service smoke runs`, `Independent read-only SQL confirms scholarly_works, total_citations, total_references, authors and institutions for the same window`, `Response top and growth ordering differ when data supports it`, `Citation/trending coverage is internally consistent`, `git diff --cached --check passes`, `No migration, production write, commit or push`
- [x] Stage gate: Stage final docs and evidence only after exact verification results are recorded.

Evidence:

- Syntax passed: `node --check src/services/articleAnalysis.service.js`, `node --check src/controllers/article.controller.js`, `node --check src/routes/article.route.js`.
- Focused tests passed: `node --test src/tests/unit/service/article.test.js src/tests/unit/service/articleFilter.test.js src/tests/unit/service/articleAnalysis.test.js` (38/38).
- Full suite attempted: `npm.cmd test` exited 1 on unrelated legacy failures, including keyword mock redefinition, subject-category expectation drift, and stale issue service/controller tests.
- Read-only service smoke for `scope=vn_universities` succeeded with window 2025-2026. Summary: scholarly_works=26, total_citations=6, total_references=624, available_citing_works=2, available_references=207, authors=52, institutions=22. Independent read-only SQL returned the same key totals with no mismatches. Trending coverage returned eligible_articles=31 and total_articles=60.
- Data did not show differing first institution between top and growth (`20` for both), but query ordering is covered by focused tests and both arrays returned 10 rows.

## Final Acceptance

- [x] All task cards are checked.
- [x] Required checks pass.
- [x] Handoff explains staged state, residual risks, and next bottleneck if any.
