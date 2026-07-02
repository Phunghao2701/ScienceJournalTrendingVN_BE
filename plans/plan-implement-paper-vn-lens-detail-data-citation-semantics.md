---
title: "Implement Paper VN Lens Detail Data and Citation Semantics"
kind: "plan"
created_at: "2026-06-29T13:48:29.753Z"
source: "repo-harness-mcp"
---
# Implement Paper VN Lens Detail Data and Citation Semantics

> **PRD**: `plans/prds/20260629-2046-paper-vn-lens-detail-data-citation-semantics.prd.md`
> **Sprint**: `plans/sprints/20260629-2047-paper-vn-lens-detail-data-citation-semantics.sprint.md`
> **Target branch**: `hao/refactor/BE`
> **Execution order**: Complete the BE contract before FE contract-dependent phases.

## Goal

Provide a reliable Lens-style article detail contract with exact-year affiliations, truthful optional metadata, explicit count semantics and citing-works year analytics.

## Phase 0 — Recover and establish baseline

1. Read repo instructions, current handoff, PRD and sprint.
2. Inspect git status and preserve unrelated changes.
3. Run focused article detail/citation tests.
4. Save current response examples for comparison.

## Phase 1 — Normalize detail metadata

1. Audit actual Article/Issue/Volume/Journal/Publisher fields.
2. Return only real values for volume, issue, pages and dates.
3. Keep absent optional values null/omitted according to repo conventions.
4. Remove any controller/service fallback that fabricates E-Published, license or external IDs.
5. Add response-shape tests.

**Checkpoint:** article detail metadata is truthful and backward-compatible where possible.

## Phase 2 — Author affiliations and institutions

1. Query authors through `Author_Article`.
2. Join `Institution_Author` with `year = Article.publication_year`.
3. Join non-deleted `Institution` records.
4. Return institutions per author.
5. Return a deduplicated article-level institutions array.
6. Do not treat `last_known_institution` as exact-year affiliation.

**Checkpoint:** representative VN articles return expected author–institution mappings.

## Phase 3 — Count semantics

1. Preserve `Article.citation_count` as imported citation metric.
2. Preserve `Article.reference_count` as imported reference metric.
3. Add `citing_works_count` from `Article_Citing_Work`.
4. Add `available_references_count` from `Article_Reference`.
5. Document differences and add tests for mismatched values.

**Checkpoint:** no field changes meaning during request processing.

## Phase 4 — Citing works year analytics

1. Aggregate all citing-work records by publication year.
2. Return total and sorted distribution.
3. Handle null year explicitly.
4. Add route/controller/service tests.

**Checkpoint:** analytics total equals citing-works count.

## Phase 5 — Entity label contracts

Verify journal, publisher, author, topic and keyword by-ID APIs. Normalize only as needed so each response exposes a stable ID and display name suitable for FE filter-chip resolution.

**Checkpoint:** concrete endpoint examples are documented.

## Phase 6 — Verification and handoff

1. Run focused tests.
2. Run full available suite and separate pre-existing failures.
3. Update API contract documentation.
4. Update handoff with changed files, commands, outputs and limitations.
5. Confirm no core Trending VN files changed.
6. Do not commit automatically.

## Stop Conditions

Stop and report instead of guessing when:

- requested page/date fields do not exist in schema;
- exact-year affiliation coverage is missing for a record;
- a change would require a migration;
- normalizing an entity endpoint would break a documented consumer;
- a change would touch core Trending VN.
