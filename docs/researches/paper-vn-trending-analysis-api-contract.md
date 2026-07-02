# Paper VN Trending Analysis API Contract

Updated: 2026-06-30 (institution_id and topic_id semantics corrective)

## Endpoint

`GET /api/v1/articles/analysis`

The endpoint uses the same discovery filters as `GET /api/v1/articles`:

- `scope=all|vn_universities`
- `search`
- `publication_year` or `year`
- `from_year` and `to_year` for the current analysis window
- `journal_id`, `topic_id`, `publisher_id`, `author_id`, `keyword_id`, `institution_id`, `volume_id`, `issue_id`
- `access=oa|closed|all` or `is_open_access`
- `country_id`
- `limit` for ranked lists

`institution_id` filters the cohort to one exact-year institution affiliation (see Discovery API Contract), independent of the `institutions` ranking entity below. `topic_id` filters using primary-topic-OR-Sub_Topic, matching how the `topics` ranking entity unions primary topic and `Sub_Topic`.

`scope=vn_universities` uses exact-year affiliation:

```text
Article -> Author_Article -> Institution_Author(year = Article.publication_year) -> Institution(country_code = VN, type = education)
```

The analysis endpoint does not use `Author.last_known_institution`.

## Window Rules

Years must be integers from 1800 through the current year plus one.

If `from_year` and `to_year` are provided, both are required, `from_year <= to_year`, and the inclusive current window is capped at 25 years. Invalid, reversed, out-of-range, partial, or overlong windows return `INVALID_ANALYSIS_WINDOW`.

If no explicit window is provided and `publication_year` is provided, the current window is that single year and the comparison window is the previous year.

If neither an explicit window nor `publication_year` is provided, the endpoint finds the latest publication year in the filtered cohort, uses the latest two years as current, and uses the immediately preceding two years as comparison.

## Response Shape

```json
{
  "scope": "vn_universities",
  "window": {
    "current": { "from_year": 2023, "to_year": 2024 },
    "comparison": { "from_year": 2021, "to_year": 2022 },
    "years": [2021, 2022, 2023, 2024],
    "mode": "default_latest"
  },
  "summary": {
    "scholarly_works": 0,
    "total_citations": 0,
    "total_references": 0,
    "available_citing_works": 0,
    "available_references": 0,
    "authors": 0,
    "institutions": 0,
    "journals": 0,
    "open_access_works": 0,
    "closed_access_works": 0,
    "oa_unavailable_works": 0
  },
  "works_over_time": [{ "year": 2024, "count": 0 }],
  "citations_over_time": [
    {
      "year": 2024,
      "citations": 0,
      "coverage_articles": 0,
      "total_articles_with_history": 0
    }
  ],
  "top": {
    "institutions": [],
    "authors": [],
    "journals": [],
    "topics": [],
    "keywords": []
  },
  "growth": {
    "institutions": [],
    "authors": [],
    "journals": [],
    "topics": [],
    "keywords": []
  },
  "trending_articles": [],
  "trending_article_coverage": {
    "eligible_articles": 0,
    "total_articles": 0
  }
}
```

## Summary and Time Series

`total_citations` and `total_references` come from imported `Article.citation_count` and `Article.reference_count`.

`available_citing_works` and `available_references` are local relation-row counts from `Article_Citing_Work` and `Article_Reference`. They are coverage fields, not replacements for imported totals.

`works_over_time` is zero-filled from comparison start through current end.

`citations_over_time` only aggregates valid numeric values from valid four-digit keys in `Article.citations_by_year`. Missing citation history is unavailable, not zero.

`total_articles_with_history` is computed once for the filtered cohort and repeated for every zero-filled citation year.

## Entity Ranking and Growth

Each ranked entity row uses this shape:

```json
{
  "rank": 1,
  "entity_id": "10",
  "display_name": "Entity",
  "current_count": 2,
  "previous_count": 1,
  "absolute_growth": 1,
  "growth_rate": 1
}
```

`top` arrays are sorted by `current_count` descending, then `absolute_growth` descending, then `display_name` ascending.

`growth` arrays are sorted by `absolute_growth` descending, then `current_count` descending, then `display_name` ascending.

`growth_rate` is a decimal ratio where `1.0` means 100% growth. It is `null` when `previous_count = 0`.

Institutions use exact-year affiliation. With `scope=vn_universities`, institution ranking includes only VN education institutions.

Authors count distinct article-author pairs. Journals count distinct articles through the article's issue-volume-journal path. Topics union primary topic and `Sub_Topic` and dedupe by article/topic. Keywords use `Keyword_Article` and dedupe by article/keyword.

## Trending Articles

`trending_articles` includes only articles with usable `citations_by_year` JSON object history. The endpoint does not fabricate opaque scores and does not fall back to citing-work relation counts.

`trending_article_coverage.eligible_articles` uses the same valid citation-history window semantics as `trending_articles`. `trending_article_coverage.total_articles` is the filtered discovery cohort denominator, not a current-publication-year count.

Each row includes:

```json
{
  "article_id": "99",
  "title": "Citation History Paper",
  "publication_year": 2024,
  "journal_id": "5",
  "journal_name": "Journal",
  "citation_count": 8,
  "reference_count": 10,
  "current_citations": 5,
  "previous_citations": 2,
  "absolute_growth": 3,
  "growth_rate": 1.5
}
```

Sorting is deterministic by absolute growth, current citation activity, imported citation count, publication year, and title.

## Verification

Focused checks:

```text
node --test src/tests/unit/service/articleAnalysis.test.js
node --test src/tests/unit/service/article.test.js src/tests/unit/service/articleFilter.test.js src/tests/unit/service/articleAnalysis.test.js
```

Syntax checks:

```text
node --check src/services/articleAnalysis.service.js
node --check src/controllers/article.controller.js
node --check src/routes/article.route.js
```
