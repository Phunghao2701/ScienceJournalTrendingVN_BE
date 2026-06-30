---
title: "Implement Paper VN Discovery Backend Contract"
kind: "plan"
created_at: "2026-06-29T05:48:45.572Z"
source: "repo-harness-mcp"
---
# Implement Paper VN Discovery Backend Contract

> **Status**: Active candidate
> **PRD**: `plans/prds/20260629-1246-paper-vn-discovery-scope-api.prd.md`
> **Sprint**: `plans/sprints/20260629-1247-paper-vn-discovery-backend.sprint.md`
> **Target branch**: `hao/refactor/BE`

## Goal

Provide a verified backend contract for the Paper VN Article Discovery page before any frontend integration begins.

## Execution Strategy

Work in small, testable phases. Do not edit core Trending VN. Preserve unrelated dirty worktree changes. Use the existing database schema; do not create migrations.

## Task Breakdown

### Phase 0 — Recovery and baseline

- Read `AGENTS.md`, PRD, sprint, handoff and package scripts.
- Inspect git status and preserve unrelated changes.
- Run current relevant tests to establish a baseline.
- Record failures that predate this work.

**Checkpoint 0**: baseline commands and results recorded.

### Phase 1 — Evidence-driven affiliation scope

- Run read-only SQL for institution country codes, institution types and exact-year coverage.
- Write `docs/researches/paper-vn-affiliation-scope.md`.
- Select accepted VN codes/types from actual data.

**Checkpoint 1**: no implementation until scope constants are evidenced.

### Phase 2 — Shared filter contract

- Refactor article filtering into a reusable builder/predicate.
- Validate `scope=all|vn_universities`.
- Validate `access=oa|closed`.
- Add strict exact-year affiliation predicate.
- Whitelist sort fields and directions.

**Checkpoint 2**: focused controller/service tests pass.

### Phase 3 — List/count/stats consistency

- Apply the same filter inputs to list, count and stats.
- Add `data.scope` to response.
- Ensure stats are no longer global under filtered requests.
- Prevent duplicate articles caused by affiliation joins.

**Checkpoint 3**: list total and stats agree for representative filters.

### Phase 4 — List projection for FE

- Extend article list response with all card metadata and authors.
- Verify stable response shape and no row multiplication.
- Document example JSON for FE.

**Checkpoint 4**: FE can render a card without calling article detail.

### Phase 5 — Related discovery endpoints

- Add ISSN support to journal search.
- Add scope and validated sort to keyword/topic article endpoints.
- Preserve pagination totals under scope.

**Checkpoint 5**: endpoint integration tests pass.

### Phase 6 — Filter-consistent analytics

- Add `GET /api/v1/articles/analytics` before dynamic `/:id` routing.
- Reuse the same filter builder.
- Return totals, years, publishers, authors, topics and access distribution.
- Use distinct article IDs in aggregations.

**Checkpoint 6**: analytics totals match article count for identical filters.

### Phase 7 — Full verification and handoff

- Run targeted and full available tests.
- Run lint/build/startup checks from package scripts.
- Inspect query behavior for obvious duplicate/N+1 issues.
- Update handoff with final contract, changed files and limitations.
- Do not commit unless explicitly requested.

## Verification Matrix

- Scope: VN, foreign-only, mixed collaboration, wrong affiliation year, soft-deleted author/institution.
- Filters: search, year, journal, topic, access, volume, issue.
- Pagination: page/limit/total/total_pages.
- Sorting: valid and invalid values.
- Search: title, abstract, DOI, ISSN and any expanded sources implemented.
- Analytics: count parity and no duplicate aggregation.

## Stop Conditions

Stop and report instead of guessing when:

- Real institution type values are ambiguous.
- Exact-year affiliation coverage is unexpectedly near zero.
- Existing schema differs from the supplied schema.
- A required change would alter core Trending VN or require a migration.

## Rollback Boundary

Changes should be isolated to article, journal, keyword/topic discovery contracts, focused helpers/tests and research/handoff files. Core Trending VN files must remain untouched.
