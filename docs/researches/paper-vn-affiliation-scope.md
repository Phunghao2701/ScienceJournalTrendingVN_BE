# Paper VN Affiliation Scope Research

Created: 2026-06-29

## Purpose

Verify real `Institution.country_code` and `Institution.type` values before implementing `scope=vn_universities`.

## Read-Only SQL

```sql
SELECT country_code, COUNT(*)::int AS count
FROM "Institution"
GROUP BY country_code
ORDER BY count DESC NULLS LAST, country_code NULLS LAST;
```

Summary: `VN` is the only Vietnam country code present. It appears on 34 institutions. No `VNM`, `Vietnam`, or `Viet Nam` values were present.

```sql
SELECT type, COUNT(*)::int AS count
FROM "Institution"
GROUP BY type
ORDER BY count DESC NULLS LAST, type NULLS LAST;
```

Summary: institution types are `education` (74), `facility` (5), `government` (4), `company` (1), `healthcare` (1), and `other` (1).

```sql
SELECT COUNT(DISTINCT a.article_id)::int AS count
FROM "Article" a
WHERE a.is_deleted = false
  AND EXISTS (
    SELECT 1
    FROM "Author_Article" aa
    JOIN "Institution_Author" ia ON ia.author_id = aa.author_id
    JOIN "Institution" inst ON inst.institution_id = ia.institution_id
    WHERE aa.article_id = a.article_id
      AND ia.year = a.publication_year
      AND COALESCE(inst.is_deleted,false) = false
      AND UPPER(TRIM(inst.country_code)) IN ('VN','VNM')
  );
```

Summary: 43 distinct non-deleted articles have at least one exact-publication-year Vietnam affiliation when checking `VN`/`VNM`.

```sql
SELECT
  COUNT(*) FILTER (WHERE country_code IS NULL OR TRIM(country_code) = '')::int AS null_or_blank_country_code,
  COUNT(*) FILTER (WHERE type IS NULL OR TRIM(type) = '')::int AS null_or_blank_type,
  COUNT(*) FILTER (WHERE COALESCE(is_deleted,false) = true)::int AS soft_deleted
FROM "Institution";
```

Summary: 2 institutions have null/blank `country_code`, 0 have null/blank `type`, and 0 are soft-deleted.

```sql
SELECT UPPER(TRIM(country_code)) AS country_code, type, COUNT(*)::int AS count
FROM "Institution"
WHERE UPPER(TRIM(country_code)) IN ('VN','VNM')
GROUP BY UPPER(TRIM(country_code)), type
ORDER BY count DESC, type NULLS LAST;
```

Summary: Vietnam institutions break down as `education` (31), `government` (2), and `facility` (1).

## Chosen Constants

- Vietnam country codes: `VN`
- University/education institution types: `education`

## Scope Rule

`scope=vn_universities` should match a non-deleted article when an exact publication-year affiliation exists through:

`Article -> Author_Article -> Institution_Author -> Institution`

The accepted institution row must satisfy:

- `Institution_Author.year = Article.publication_year`
- `COALESCE(Institution.is_deleted, false) = false`
- `UPPER(TRIM(Institution.country_code)) = 'VN'`
- `LOWER(TRIM(Institution.type)) = 'education'`

Do not use `Journal.country` to determine the Paper VN article scope.
