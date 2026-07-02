---
title: "Paper VN Discovery Backend Sprint"
kind: "sprint"
created_at: "2026-06-29T05:47:48.005Z"
source: "repo-harness-mcp"
---
# Paper VN Discovery Backend Sprint

> **Status**: Ready
> **Source PRD**: `plans/prds/20260629-1246-paper-vn-discovery-scope-api.prd.md`
> **Execution Order**: Must complete before FE integration sprint.

## Sprint Goal

Deliver a stable backend contract for Paper VN Article Discovery where all list, count, stats, fallback and analytics results use the same `vn_universities` affiliation scope.

## Preconditions

- Preserve branch `hao/refactor/BE` and dirty worktree.
- Inspect package scripts and existing tests before editing.
- Query real `Institution.country_code` and `Institution.type` values before defining constants.
- Do not modify core `/trending-vn` endpoints.
- Do not create new database tables.

## Task Breakdown

### [x] BE-01 — Inspect affiliation data and record verified scope constants

**Outcome**
- Confirm actual Vietnam country codes and university/education institution types.
- Record findings in `docs/researches/paper-vn-affiliation-scope.md`.

**Steps**
1. Run read-only SQL counts for `Institution.country_code` and `Institution.type`.
2. Count distinct articles with exact-year VN affiliation.
3. Identify null, malformed and soft-deleted institution records.
4. Decide strict accepted country codes/types from evidence.

**Verification**
- Research note contains exact SQL, outputs summary and chosen constants.
- No schema/data mutation.

### [x] BE-02 — Build a reusable article filter/scope contract

**Depends on**: BE-01

**Expected files**
- `src/controllers/article.controller.js`
- `src/services/article.service.js`
- Optional focused helper under `src/services` or `src/utils`

**Outcome**
- `scope=all|vn_universities` is validated.
- `access=oa|closed` is validated.
- A single reusable filter builder/predicate is used by list, count and stats.

**Rules**
- `vn_universities` uses `Article -> Author_Article -> Author -> Institution_Author -> Institution`.
- Strict match: `Institution_Author.year = Article.publication_year`.
- Never use `Journal.country` for Paper VN scope.
- Invalid scope/access returns 400.
- Sort fields are whitelisted.

**Verification**
- Unit tests cover valid and invalid scope/access.
- Existing article list behavior with `scope=all` remains compatible.

### [x] BE-03 — Apply scope to article list, count and filtered stats

**Depends on**: BE-02

**Outcome**
- `/articles` list, pagination total and stats share identical filters.
- Response returns resolved scope.

**Required response behavior**
- `data.scope`
- `data.articles`
- `data.pagination.total`
- `data.stats` filtered by scope/search/year/journal/topic/access/volume/issue

**Verification**
- Integration tests compare list total and stats under the same filters.
- No duplicate articles from multi-author/multi-institution joins.

### [x] BE-04 — Expand article list projection and eliminate FE N+1 dependency

**Depends on**: BE-03

**Outcome**
- List records include journal, publisher, volume, issue, citation/reference counts and authors needed by cards.

**Required fields**
- `article_id`, `title`, `abstract`, `publication_year`, `doi`
- `primary_topic`, `topic_name`
- `journal_id`, `journal_name`, `journal_issn`
- `publisher_id`, `publisher_name`
- `volume_id`, `volume_number`, `issue_id`, `issue_number`
- `is_open_access`, `citation_count`, `reference_count`, `created_at`, `authors`

**Verification**
- API test validates field shape.
- Query plan/implementation does not multiply list rows.

### [x] BE-05 — Fix journal ISSN search

**Expected files**
- `src/services/journal.service.js`
- Relevant journal tests

**Outcome**
- `/journal?search=` matches display name and ISSN.
- Hyphenated/non-hyphenated ISSN behavior is documented and tested.

### [x] BE-06 — Apply scope and sort to keyword/topic article endpoints

**Depends on**: BE-02

**Expected files**
- `src/controllers/keyword.controller.js`
- `src/services/keyword.service.js`
- `src/controllers/topic.controller.js`
- `src/services/topic.service.js`

**Outcome**
- Both endpoints accept `scope`.
- Pagination totals respect scope.
- Topic endpoint supports whitelisted `sortBy`/`sortOrder`.

**Verification**
- VN/foreign collaboration cases are covered.
- Invalid sort/scope returns 400.

### [x] BE-07 — Add filtered article analytics endpoint

**Depends on**: BE-02, BE-03

**Expected route**
- `GET /api/v1/articles/analytics`

**Outcome**
- Analytics uses the same filter builder and scope as `/articles`.
- Returns totals, year distribution, top publishers, top authors, top topics and access distribution.

**Verification**
- Aggregations use distinct article IDs.
- Analytics totals match list/count for the same filters.

### [x] BE-08 — Regression, performance and contract verification

**Depends on**: BE-03 through BE-07

**Steps**
1. Run targeted tests.
2. Run full available test suite.
3. Run lint/build/startup validation available in `package.json`.
4. Inspect query count and obvious N+1/duplicate risks.
5. Update handoff with contract and remaining limitations.

**Deliverables**
- Actual commands and outputs.
- Changed-file list.
- Final API examples for FE.
- Explicit note that core Trending VN was untouched.

## Acceptance Criteria

- [x] `scope=vn_universities` uses exact-year institution affiliation.
- [x] Journal country is not used to define Paper VN.
- [x] List, count and stats use identical filters.
- [x] Article list returns all card metadata.
- [x] `access=oa|closed` works and invalid values fail clearly.
- [x] ISSN search works.
- [x] Keyword/topic article endpoints preserve scope.
- [x] Analytics endpoint is filter-consistent.
- [x] Focused tests pass; full `npm test` is blocked by existing unrelated/environment failures recorded in handoff.
- [x] Core Trending VN is unchanged.

## Execution Notes

- Verified constants: `Institution.country_code = 'VN'`, `Institution.type = 'education'`.
- Live read-only smoke on 2026-06-29 returned 40 `vn_universities` articles with list/count/stats/analytics all agreeing on total 40.
- Focused tests passed: `node --test src/tests/unit/service/article.test.js src/tests/unit/service/articleFilter.test.js src/tests/unit/service/paperVnDiscovery.test.js`.
- Full package test command `npm.cmd test` was run and failed on existing unrelated/environment issues, including network-blocked DB access during tests and stale test imports/expectations outside this sprint.

## Out of Scope

- Core Trending VN algorithms/endpoints.
- Bookmark persistence.
- New database schema or migrations.
- Inferred fallback to `last_known_institution_id`.

## Risks and Guards

- **Sparse exact-year affiliations**: report coverage; do not silently infer.
- **Duplicate rows**: prefer `EXISTS`, `DISTINCT` and isolated aggregation.
- **SQL injection**: whitelist sort columns and directions.
- **Contract drift**: provide concrete response examples in handoff.
