# Paper VN Discovery API Contract

Updated: 2026-06-30

## Detail Baseline Audit

BE-01 baseline for `plans/sprints/20260629-2047-paper-vn-lens-detail-data-citation-semantics.sprint.md`:

- Focused service tests pass: `node --test src/tests/unit/service/article.test.js src/tests/unit/service/articleFilter.test.js src/tests/unit/service/paperVnDiscovery.test.js` reports 27/27 passing.
- The current article detail service reads `Article -> Issue -> Volume -> Journal -> Publisher -> Topic`, returns imported `citation_count` and `reference_count`, and exposes paginated relation endpoints for `Article_Citing_Work` and `Article_Reference`.
- Citing works and references endpoints currently return paginated `items` plus `pagination.total`; citing works do not yet expose an all-row year distribution.
- Existing detail authors are loaded from `Author_Article -> Author`; exact-year `Institution_Author -> Institution` affiliation data is not yet projected on the detail response.
- Representative contract examples are documented below in the Article Detail, Citing Works Analytics, and Citation Count Semantics sections.

## Shared Article Filters

`GET /api/v1/articles` and `GET /api/v1/articles/analytics` share the same article filter predicate.

Supported query filters:

- `scope`: `all` or `vn_universities`
- `search`: unified text search across article title, abstract, DOI, journal display name, ISSN, publisher display name, author display name, keyword display name, primary topic, and sub-topic
- `publication_year` or `year`
- `journal_id` or `journal`
- `topic_id` or `topic`
- `publisher_id` or `publisher`
- `author_id` or `author`
- `keyword_id` or `keyword`
- `institution_id` or `institution`
- `volume_id`
- `issue_id`
- `access`: `oa`, `closed`, or `all`
- `is_open_access`: boolean-compatible legacy alias
- `country_id` or `country`

Entity filters `publisher_id`, `author_id`, `keyword_id`, and `institution_id` must be positive integers. Invalid values return a 400-style service error with code `INVALID_ENTITY_ID`.

`institution_id` matches a non-deleted article when an exact publication-year affiliation exists through `Article -> Author_Article -> Author -> Institution_Author(year = Article.publication_year) -> Institution`, with the matched author and institution both not soft-deleted. It does not use `Author.last_known_institution`. `institution_id` can coexist with `scope=vn_universities`; the two predicates are independent (`institution_id` pins one exact institution row, `scope` constrains to VN education institutions generally).

`topic_id` matches a non-deleted article when the topic is either `Article.primary_topic` or appears in `Sub_Topic` for that article (soft-deleted `Topic` rows excluded from the `Sub_Topic` branch). This mirrors how Analysis topic ranking unions primary topic and `Sub_Topic`. The predicate uses `EXISTS`, so an article matching the topic through both primary and sub-topic is still counted once.

Access filters and counts use `Article.is_open_access` as the source of truth. `oa` maps to `IS TRUE`, `closed` maps to `IS FALSE`, and null is exposed as `unknown` instead of being folded into closed access.

## VN Universities Scope

`scope=vn_universities` is defined by exact-year author affiliation:

- `Article.publication_year = Institution_Author.year`
- `Institution.country_code = 'VN'`
- `Institution.type = 'education'`
- soft-deleted institutions are excluded
- soft-deleted authors are excluded

Journal country is not part of the Paper VN scope definition.

## Unified Search

`GET /api/v1/articles?search=<term>` returns normal full article card metadata and does not require FE fallback calls to keyword/topic endpoints.

Many-to-many sources use `EXISTS` predicates to avoid duplicate article rows:

- authors through `Author_Article`
- keywords through `Keyword_Article`
- sub-topics through `Sub_Topic`

Search and count use the same shared filter builder, so list totals, stats, and analytics stay aligned.

## Article Summary Shape

Article list, keyword article fallback, and topic article fallback return the same summary fields when available:

- `article_id`, `version`, `issue_id`
- `title`, `abstract`, `publication_year`, `doi`, `created_at`
- `primary_topic`, `topic_name`
- `journal_id`, `journal_name`, `journal_issn`
- `publisher_id`, `publisher_name`
- `volume_id`, `volume_number`, `issue_number`
- `is_open_access`
- `citation_count`, `reference_count`
- `authors`: array of `{ author_id, display_name }`

Keyword/topic fallback endpoints remain compatible and still apply scope, sort, pagination, and totals through the shared article filter.

## Article Detail Shape

`GET /api/v1/articles/:id` returns imported article metadata plus available relationship data without synthetic Lens-only fields.

Example:

```json
{
  "article_id": "10",
  "title": "Lens Detail Paper",
  "publication_year": 2024,
  "doi": "10.example/paper",
  "journal_id": "2",
  "journal_name": "Journal Name",
  "journal_issn": "1234-5678",
  "publisher_id": "3",
  "publisher_name": "Publisher Name",
  "volume_id": "4",
  "volume_number": "12",
  "issue_id": "5",
  "issue_number": "2",
  "citation_count": 12,
  "reference_count": 34,
  "citing_works_count": 5,
  "available_references_count": 7,
  "authors": [
    {
      "author_id": "99",
      "display_name": "Author Name",
      "orcid": null,
      "institutions": [
        {
          "institution_id": "15",
          "display_name": "Vietnam University",
          "country_code": "VN",
          "type": "education"
        }
      ]
    }
  ],
  "institutions": [
    {
      "institution_id": "15",
      "display_name": "Vietnam University",
      "country_code": "VN",
      "type": "education"
    }
  ],
  "keywords": [],
  "topics": []
}
```

Author institutions use exact-year affiliation only:

```text
Article.publication_year = Institution_Author.year
Author_Article.author_id = Institution_Author.author_id
Institution_Author.institution_id = Institution.institution_id
```

Soft-deleted authors and institutions are excluded. `last_known_institution` may remain on author records for compatibility, but it is not used as the primary affiliation source.

The backend does not synthesize page ranges, e-publication dates, licenses, WorldCat, LibKey, or other external identifiers when the current schema/data does not provide them.

## Citation Count Semantics

| Field | Source | Meaning |
| --- | --- | --- |
| `citation_count` | `Article.citation_count` | Imported upstream article metric. |
| `reference_count` | `Article.reference_count` | Imported upstream article metric. |
| `citing_works_count` | `COUNT(*) FROM Article_Citing_Work` | Number of locally available citing-work records. |
| `available_references_count` | `COUNT(*) FROM Article_Reference` | Number of locally available reference records. |

The paginated relationship endpoints continue to expose `pagination.total`; FE should treat that total as the available relation-record count, not as the imported upstream metric.

## Citing Works Analytics

`GET /api/v1/articles/:id/citing-works/analytics` returns an all-row aggregation over `Article_Citing_Work`, independent of citing-work pagination.

Example:

```json
{
  "total": 5,
  "year_distribution": [
    { "year": 2021, "count": 1 },
    { "year": 2022, "count": 3 },
    { "year": null, "count": 1 }
  ]
}
```

Years are ordered ascending with null years last. `total` equals the full `Article_Citing_Work` row count for the article.

## Entity Label Endpoints

Filter-chip label resolution can use these by-ID endpoints. Each returns a stable ID and `display_name` when the entity exists:

- `GET /api/v1/journals/:id` -> `journal_id`, `display_name`
- `GET /api/v1/publishers/:id` -> `publisher_id`, `display_name`
- `GET /api/v1/authors/:id` -> `author_id`, `display_name`
- `GET /api/v1/topics/:id` -> `topic_id`, `display_name`
- `GET /api/v1/keywords/:id` -> `keyword_id`, `display_name`

## Analytics Shape

`GET /api/v1/articles/analytics` returns:

```json
{
  "scope": "vn_universities",
  "totals": {
    "totalArticles": 0,
    "openAccessCount": 0,
    "closedAccessCount": 0,
    "unknownAccessCount": 0
  },
  "yearDistribution": [
    { "year": 2024, "count": 10 }
  ],
  "topPublishers": [
    { "publisher_id": "1", "display_name": "Publisher", "article_count": 10 }
  ],
  "topAuthors": [
    { "author_id": "1", "display_name": "Author", "article_count": 10 }
  ],
  "topTopics": [
    { "topic_id": "1", "display_name": "Topic", "article_count": 10 }
  ],
  "topInstitutions": [
    { "institution_id": "1", "display_name": "Institution", "article_count": 10 }
  ],
  "accessDistribution": [
    { "key": "oa", "label": "Open access", "count": 0 },
    { "key": "closed", "label": "Closed access", "count": 0 },
    { "key": "unknown", "label": "Unknown", "count": 0 }
  ]
}
```

Null publishers/topics are excluded from the top entity lists so FE entity drill-down only receives filterable rows.

`topInstitutions` uses exact-year author affiliation. With `scope=vn_universities`, it includes only VN education institutions.

## Verification

Focused check:

```text
node --test src/tests/unit/service/article.test.js src/tests/unit/service/articleFilter.test.js src/tests/unit/service/paperVnDiscovery.test.js
```

Syntax check:

```text
node --check src/services/articleFilter.service.js
node --check src/services/article.service.js
node --check src/controllers/article.controller.js
node --check src/services/keyword.service.js
node --check src/services/topic.service.js
node --check src/controllers/topic.controller.js
```

Full suite command attempted:

```text
npm.cmd test
```

The full suite still fails on existing unrelated/sandbox issues including PostgreSQL `EACCES`, stale issue exports, mock redefine failures, and older expectation mismatches.
