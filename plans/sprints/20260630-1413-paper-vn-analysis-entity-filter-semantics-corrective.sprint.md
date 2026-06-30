---
title: "Paper VN Analysis Entity Filter Semantics Corrective Sprint"
kind: "sprint"
created_at: "2026-06-30T07:13:02.710Z"
source: "repo-harness-mcp"
---
# Paper VN Analysis Entity Filter Semantics Corrective Sprint

> **Status**: Completed

## Source

- PRD: `plans/prds/20260630-1412-paper-vn-analysis-entity-filter-semantics-corrective.prd.md`

## Execution Rule

- Execute task cards in order.
- Keep each task card reviewable as one staged slice.
- After every completed phase, update the checklist and stage the result before continuing.
- Do not treat unstaged work as a completed phase.

## Checklist

### Task Card 1: BE-ENTITY-01 — Baseline and failing filter tests

- [x] Objective: Confirm branch hao/refactor/BE, preserve dirty/staged work, inspect shared filter/controller/analysis usage, then add failing tests for institution_id support, exact-year affiliation semantics and topic primary-or-subtopic behavior before production changes.
- [x] Files/entrypoints: `src/services/articleFilter.service.js`, `src/controllers/article.controller.js`, `src/tests/unit/service/articleFilter.test.js`, `src/tests/unit/service/articleAnalysis.test.js`
- [x] Verification: `Confirm branch hao/refactor/BE`, `Record git status --short`, `Run existing focused filter/analysis tests`, `Add failing tests for institution_id, invalid IDs, exact-year predicate and topic OR Sub_Topic semantics`, `No live DB/network access in automated tests`
- [x] Stage gate: Stage only regression tests and baseline evidence once failures are demonstrated.

### Task Card 2: BE-ENTITY-02 — Add exact-year institution filter

- [x] Objective: Thread institutionId through list, analytics and analysis controller/service params and implement a shared exact-year EXISTS predicate in buildArticleFilter.
- [x] Files/entrypoints: `src/controllers/article.controller.js`, `src/services/articleFilter.service.js`, `src/services/article.service.js`, `src/services/articleAnalysis.service.js`, `src/tests/unit/service/articleFilter.test.js`, `src/tests/unit/service/articleAnalysis.test.js`
- [x] Verification: `Controllers read institution_id/institution`, `toOptionalPositiveInteger validates institution_id`, `Predicate joins Author_Article→Author→Institution_Author(year=publication_year)→Institution`, `Soft-deleted authors/institutions are excluded`, `No last_known_institution usage`, `Placeholder/value ordering remains correct`, `Scope and institution filters can coexist`
- [x] Stage gate: Stage institution filter implementation after focused tests pass.

### Task Card 3: BE-ENTITY-03 — Align topic filter with ranking semantics

- [x] Objective: Change topic filtering to match both Article.primary_topic and Sub_Topic relations using EXISTS/OR semantics without duplicating articles.
- [x] Files/entrypoints: `src/services/articleFilter.service.js`, `src/tests/unit/service/articleFilter.test.js`, `src/tests/unit/service/articleAnalysis.test.js`
- [x] Verification: `Primary-topic article matches`, `Sub-topic-only article matches`, `Article matching both remains one cohort row`, `Soft-deleted Topic rows are not accepted where relevant`, `Existing topic_id validation and parameter order remain stable`
- [x] Stage gate: Stage topic semantics after focused regression tests pass.

### Task Card 4: BE-ENTITY-04 — Contract docs, read-only smoke and closeout

- [x] Objective: Document institution_id and topic semantics, run syntax/focused/full checks, then perform read-only Supabase smoke comparing endpoint counts with independent SQL for one institution and one topic. Update sprint, handoff and checks without commit/push.
- [x] Files/entrypoints: `docs/researches/paper-vn-discovery-api-contract.md`, `docs/researches/paper-vn-trending-analysis-api-contract.md`, `plans/sprints/20260630-1413-paper-vn-analysis-entity-filter-semantics-corrective.sprint.md`, `.ai/harness/handoff/current.md`, `.ai/harness/checks/latest.json`
- [x] Verification: `node --check passes`, `Focused articleFilter/article/analysis tests pass`, `Full suite attempted and unrelated failures documented`, `Read-only institution smoke count matches SQL`, `Read-only topic smoke includes primary and sub-topic matches`, `git diff --cached --check passes`, `No migration, production write, commit or push`
- [x] Stage gate: Stage docs and evidence only after exact smoke results are recorded.

## Final Acceptance

- [x] All task cards are checked.
- [x] Required checks pass.
- [x] Handoff explains staged state, residual risks, and next bottleneck if any.
