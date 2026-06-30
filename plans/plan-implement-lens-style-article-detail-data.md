---
title: "Implement Lens-Style Article Detail Data"
kind: "plan"
created_at: "2026-06-29T13:44:44.234Z"
source: "repo-harness-mcp"
---
# Implement Lens-Style Article Detail Data

> PRD: `plans/prds/20260629-2040-lens-style-article-detail-data-institution-analytics.prd.md`
> Sprint: `plans/sprints/20260629-2043-lens-style-article-detail-data.sprint.md`
> Target branch: `hao/refactor/BE`
> Dependency order: complete this backend plan before the frontend plan.

## Goal

Provide a truthful, stable backend contract for Lens-style Paper VN article detail and sidebars without fabricating unavailable metadata.

## Phase 0 — Baseline and schema audit

- Read repo instructions, current handoff, PRD and sprint.
- Preserve unrelated dirty-worktree changes.
- Run focused article tests.
- Inspect the real schema for publication dates, pages, identifiers, source links, author affiliations and institution images.
- Record unavailable fields instead of guessing.

## Phase 1 — Filter label resolution

- Add a dedicated route before `/:id` that resolves any provided `journal_id`, `publisher_id`, `author_id`, `topic_id`, `keyword_id`, and `institution_id`.
- Validate IDs and return a stable object per entity: `{ id, display_name, found }`.
- Exclude deleted records.
- Add controller/service tests.

## Phase 2 — Author affiliations and institution list

- Extend article detail authors with affiliations from `Institution_Author` matching `Article.publication_year`.
- Return `author.institutions[]` and a deterministic deduplicated `article.institutions[]`.
- Include real institution image/logo fields when available.
- Exclude deleted authors and institutions.

## Phase 3 — Count semantics

Return distinct fields:

```text
citation_count
reference_count
available_citing_works_count
available_references_count
```

Do not overwrite imported metrics with local relation-table counts. Add tests where the values intentionally differ.

## Phase 4 — Citing works year analytics

- Add a non-paginated aggregation for `Article_Citing_Work.publication_year`.
- Return sorted `{ year, count }` rows.
- Document null-year handling.
- Ensure chart totals are explainable against available citing works.

## Phase 5 — Institution discovery filter and analytics

- Add `institution_id` to the reusable article filter builder.
- Apply it consistently to list, count, stats and analytics.
- Use publication-time affiliation and distinct article IDs.
- Add `topInstitutions` with ID, display name, image/logo and article count.

## Phase 6 — Truthful detail metadata

- Normalize journal, publisher, ISSN, DOI, publication type, publication year and any genuinely available date/page fields.
- Return external identifiers and URLs only when stored or safely derivable.
- Never label internal article IDs as OpenAlex/WorldCat/etc.
- Document fields unavailable in the current schema so FE can hide them.

## Phase 7 — Verification and handoff

- Run focused and full available checks.
- Publish exact response examples for filter labels, enriched detail, count semantics, citing-year analytics and institution analytics.
- Update `.ai/harness/handoff/current.md` with changed files, commands, results and limitations.
- Confirm core `/trending-vn` logic is untouched.
- Do not commit automatically.

## Stop conditions

Stop and report instead of guessing if a requested field requires a migration, if affiliation-year data is unavailable, or if a contract change would break a documented consumer outside Paper VN.
