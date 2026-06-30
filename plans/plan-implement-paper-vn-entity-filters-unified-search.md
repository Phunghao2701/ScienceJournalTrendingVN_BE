---
title: "Implement Paper VN Entity Filters and Unified Search"
kind: "plan"
created_at: "2026-06-29T07:20:09.378Z"
source: "repo-harness-mcp"
---
# Implement Paper VN Entity Filters and Unified Search

> **PRD**: `plans/prds/20260629-1416-paper-vn-entity-filters-unified-search.prd.md`
> **Sprint**: `plans/sprints/20260629-1418-paper-vn-entity-filters-unified-search.sprint.md`
> **Target branch**: `hao/refactor/BE`
> **Execution order**: Complete before the FE follow-up sprint.

## Goal

Make `/articles` and `/articles/analytics` the single, filter-consistent source for Paper VN discovery, with stable ID filters for journal, publisher, author, topic and keyword and a normalized analytics response.

## Phase 0 — Recover current state

1. Read repo instructions, current handoff, PRD and sprint.
2. Inspect git status and preserve unrelated changes.
3. Run focused baseline tests.
4. Record current request/response examples.

## Phase 1 — Shared entity filter contract

1. Add `publisherId`, `authorId`, and `keywordId` to the shared filter builder.
2. Validate positive numeric IDs.
3. Use `EXISTS` for author and keyword filters.
4. Keep journal/topic/volume/issue/access/scope behavior unchanged.
5. Normalize resolved scope before returning it from controllers.

**Checkpoint**: unit tests for every entity filter pass.

## Phase 2 — Correct VN scope semantics

1. Join `Author` in the scope predicate.
2. Exclude soft-deleted authors.
3. Preserve strict `Institution_Author.year = Article.publication_year`.
4. Keep Institution country/type checks evidence-based.

**Checkpoint**: scope tests include soft-deleted author cases.

## Phase 3 — Unified article search

1. Expand search to title, abstract and DOI.
2. Add journal name and ISSN.
3. Add publisher name.
4. Add author display name via `EXISTS`.
5. Add keyword display name via `EXISTS`.
6. Add primary/sub-topic display name via `EXISTS` or equivalent safe query.
7. Ensure list/count/stats/analytics reuse the same predicate.
8. Prevent duplicate articles.

**Checkpoint**: representative searches return full article summary metadata and matching totals.

## Phase 4 — Normalize analytics response

Return stable shapes:

```json
{
  "topPublishers": [
    { "publisher_id": "1", "display_name": "Springer", "article_count": 29 }
  ],
  "topAuthors": [
    { "author_id": "2", "display_name": "Hong Duc Nguyen", "article_count": 2 }
  ],
  "topTopics": [
    { "topic_id": "3", "display_name": "Geometry", "article_count": 5 }
  ],
  "accessDistribution": [
    { "key": "oa", "label": "Open Access", "count": 10 },
    { "key": "closed", "label": "Closed Access", "count": 30 }
  ]
}
```

Exclude null entities from clickable rankings or mark them explicitly as non-filterable.

**Checkpoint**: analytics total matches `/articles` total under identical filters.

## Phase 5 — Fallback endpoint compatibility

1. Keep keyword/topic article routes available.
2. Return the same article summary shape as `/articles`.
3. Remove hard-coded citation values.
4. Keep scope, sorting and pagination consistent.

These endpoints become compatibility APIs, not the primary FE search path.

## Phase 6 — Verification and handoff

1. Run focused tests.
2. Run full available suite and record pre-existing failures separately.
3. Update API contract documentation.
4. Add concrete request examples for `publisher_id`, `author_id`, `keyword_id`.
5. Confirm no core `/trending-vn` implementation was changed.
6. Do not commit unless explicitly requested.

## Stop conditions

Stop and report instead of guessing if:

- Existing schema differs from assumptions.
- Unified search would require a new index or migration for correctness.
- Normalizing analytics breaks another documented consumer.
- A change would touch core Trending VN logic.
