---
title: "Paper VN Lens Detail Data and Citation Semantics Sprint"
kind: "sprint"
created_at: "2026-06-29T13:47:46.159Z"
source: "repo-harness-mcp"
---
# Paper VN Lens Detail Data and Citation Semantics Sprint

> **PRD**: `plans/prds/20260629-2046-paper-vn-lens-detail-data-citation-semantics.prd.md`
> **Target branch**: `hao/refactor/BE`

## Sprint Goal

Provide a trustworthy article-detail contract for the Lens-style Paper VN UI: clean optional metadata, exact-year author affiliations, explicit citation/reference semantics, citing-works year analytics, and stable entity labels.

## Tasks

### [x] BE-01 — Baseline and contract audit

- Read `AGENTS.md`, current handoff, PRD and existing article detail code.
- Inspect git status and preserve unrelated changes.
- Run focused detail/citation tests.
- Record current response examples for article detail, citing works and references.

**Stage gate:** stage baseline notes/tests only.

Completed: baseline audit recorded in `docs/researches/paper-vn-discovery-api-contract.md`; focused baseline tests passed 27/27.

### [x] BE-02 — Normalize article detail metadata

Expected files:

- `src/services/article.service.js`
- `src/controllers/article.controller.js`

Requirements:

- Keep real journal, publisher, volume, issue, ISSN and publication-year data.
- Return publication date, page range, publication type and external identifiers only when backed by schema/data.
- Do not synthesize E-Published, pages, license, WorldCat, LibKey or external IDs.
- Optional absent values remain `null` or omitted according to repo conventions.

**Stage gate:** stage metadata projection and tests separately.

Completed: detail metadata keeps real journal, publisher, ISSN, volume, issue, publication year and DOI/source URL; synthetic page/date/license/external-ID fields were not introduced.

### [x] BE-03 — Add author affiliations and article institutions

Use:

```text
Article
→ Author_Article
→ Author
→ Institution_Author where year = publication_year
→ Institution
```

Return per author:

```json
{
  "author_id": "124",
  "display_name": "Author Name",
  "orcid": null,
  "institutions": [
    {
      "institution_id": "15",
      "display_name": "University Name",
      "country_code": "VN",
      "type": "education"
    }
  ]
}
```

Also return a deduplicated article-level `institutions` array if useful.

Rules:

- Exact-year affiliation is primary.
- Exclude soft-deleted author/institution records.
- Do not use `last_known_institution` as primary affiliation.

**Stage gate:** stage query, response mapping and tests after checking representative records.

Completed: authors now include exact-year `Institution_Author -> Institution` affiliations and a deduplicated article-level `institutions` array.

### [x] BE-04 — Separate metric counts from available relation records

Detail response must distinguish:

```text
citation_count                 imported Article metric
reference_count                imported Article metric
citing_works_count             rows in Article_Citing_Work
available_references_count     rows in Article_Reference
```

Do not overwrite one count with another.

**Stage gate:** stage count semantics and contract tests separately.

Completed: imported `citation_count`/`reference_count` remain distinct from `citing_works_count`/`available_references_count`.

### [x] BE-05 — Add citing-works year analytics

Add a focused endpoint or a documented analytics block that returns all-row aggregation, not only the paginated page.

Suggested response:

```json
{
  "total": 5,
  "year_distribution": [
    { "year": 2021, "count": 1 },
    { "year": 2022, "count": 3 },
    { "year": 2023, "count": 1 }
  ]
}
```

Requirements:

- Year order ascending.
- Null year handled explicitly.
- Total equals `Article_Citing_Work` count.

**Stage gate:** stage service/controller/route/tests together.

Completed: `GET /api/v1/articles/:id/citing-works/analytics` returns all-row total plus ascending year distribution with null years last.

### [x] BE-06 — Stabilize entity-label endpoints

Verify by-ID endpoints for:

- journal
- publisher
- author
- topic
- keyword

Each response must expose a stable ID and `display_name` or a documented equivalent for filter-chip label resolution after refresh.

**Stage gate:** stage only required compatibility changes.

Completed: author and keyword by-ID responses now expose stable text IDs with `display_name`; journal, publisher and topic already satisfy the label contract.

### [x] BE-07 — Documentation and verification

- Update `docs/researches/paper-vn-discovery-api-contract.md`.
- Add final detail response example.
- Add count-semantics table.
- Add citing-works analytics example.
- Document entity label endpoints.
- Run focused and full available tests.
- Update `.ai/harness/handoff/current.md`.
- Confirm core `/trending-vn` files were untouched.

Completed: contract docs, sprint status and handoff were updated. Focused tests and syntax checks passed; full `npm.cmd test` was attempted and still fails on unrelated existing suite/environment issues.

## Acceptance Criteria

- [x] Article detail returns clean optional metadata without fabricated values.
- [x] Authors include exact-year institutions where data exists.
- [x] Article-level institutions are available for the UI.
- [x] Citation/reference metrics and available relation counts are separate.
- [x] Citing-works year analytics is available.
- [x] Entity-by-ID endpoints resolve stable display names.
- [x] Tests and documentation are updated.
- [x] No core Trending VN changes.

## Constraints

- No migrations or new tables unless explicitly approved.
- No automatic commit.
- Preserve unrelated dirty-worktree changes.
- Stop and report if the schema lacks a requested field rather than inventing data.
