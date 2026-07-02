import test from 'node:test';
import assert from 'node:assert';

import {
  buildArticleFilter,
  normalizeAccessFilter,
  normalizeArticleScope,
  normalizeArticleSort,
} from '../../../services/articleFilter.service.js';

test.describe('Article filter scope contract', () => {
  test('normalizes valid scopes', () => {
    assert.strictEqual(normalizeArticleScope(), 'all');
    assert.strictEqual(normalizeArticleScope('vn_universities'), 'vn_universities');
  });

  test('rejects invalid scope', () => {
    assert.throws(() => normalizeArticleScope('journal_country'), {
      code: 'INVALID_SCOPE',
      statusCode: 400,
    });
  });

  test('normalizes access aliases', () => {
    assert.strictEqual(normalizeAccessFilter({ access: 'oa' }), true);
    assert.strictEqual(normalizeAccessFilter({ access: 'closed' }), false);
    assert.strictEqual(normalizeAccessFilter({ access: 'all' }), undefined);
  });

  test('builds Article-level access predicates without folding null into closed', () => {
    const openFilter = buildArticleFilter({ access: 'oa' });
    assert.ok(openFilter.whereSql.includes('a."is_open_access" IS TRUE'));
    assert.ok(!openFilter.whereSql.includes('j."is_open_access"'));
    assert.deepStrictEqual(openFilter.values, []);

    const closedFilter = buildArticleFilter({ access: 'closed' });
    assert.ok(closedFilter.whereSql.includes('a."is_open_access" IS FALSE'));
    assert.ok(!closedFilter.whereSql.includes('COALESCE'));
    assert.deepStrictEqual(closedFilter.values, []);
  });

  test('rejects invalid access', () => {
    assert.throws(() => normalizeAccessFilter({ access: 'maybe' }), {
      code: 'INVALID_ACCESS',
      statusCode: 400,
    });
  });

  test('builds vn_universities scope predicate from the precomputed is_vn_journal flag', () => {
    const filter = buildArticleFilter({ scope: 'vn_universities', publicationYear: 2024 });

    assert.strictEqual(filter.scope, 'vn_universities');
    assert.ok(filter.whereSql.includes('a."is_vn_journal" IS TRUE'));
    assert.ok(!filter.whereSql.includes('Institution_Author'));
    assert.deepStrictEqual(filter.values, [2024]);
  });

  test('builds reusable publisher, author and keyword entity filters', () => {
    const filter = buildArticleFilter({
      publisherId: '12',
      authorId: '34',
      keywordId: '56',
    });

    assert.ok(filter.whereSql.includes('j."publisher_id" = $1'));
    assert.ok(filter.whereSql.includes('FROM "Author_Article" filter_aa'));
    assert.ok(filter.whereSql.includes('filter_aa."author_id" = $2'));
    assert.ok(filter.whereSql.includes('COALESCE(filter_author."is_deleted", false) = false'));
    assert.ok(filter.whereSql.includes('FROM "Keyword_Article" filter_ka'));
    assert.ok(filter.whereSql.includes('filter_ka."keyword_id" = $3'));
    assert.deepStrictEqual(filter.values, [12, 34, 56]);
  });

  test('rejects invalid entity filter IDs', () => {
    assert.throws(() => buildArticleFilter({ publisherId: '0' }), {
      code: 'INVALID_ENTITY_ID',
      statusCode: 400,
    });

    assert.throws(() => buildArticleFilter({ authorId: '-2' }), {
      code: 'INVALID_ENTITY_ID',
      statusCode: 400,
    });

    assert.throws(() => buildArticleFilter({ keywordId: 'abc' }), {
      code: 'INVALID_ENTITY_ID',
      statusCode: 400,
    });
  });

  test('builds exact-year institution EXISTS predicate (not last_known_institution)', () => {
    const filter = buildArticleFilter({ institutionId: '7' });

    assert.ok(filter.whereSql.includes('FROM "Author_Article"'));
    assert.ok(filter.whereSql.includes('JOIN "Author"'));
    assert.ok(filter.whereSql.includes('"Institution_Author"'));
    assert.ok(filter.whereSql.includes('JOIN "Institution"'));
    assert.ok(filter.whereSql.includes('"year" = a."publication_year"'));
    assert.ok(filter.whereSql.includes('COALESCE'), 'expects soft-delete guards');
    assert.ok(!filter.whereSql.includes('last_known_institution'));
    assert.deepStrictEqual(filter.values, [7]);
  });

  test('institution filter excludes soft-deleted authors and institutions', () => {
    const filter = buildArticleFilter({ institutionId: '7' });
    const authorGuardIndex = filter.whereSql.indexOf('is_deleted", false) = false');
    assert.ok(authorGuardIndex >= 0);
    const occurrences = filter.whereSql.split('COALESCE(').length - 1;
    assert.ok(occurrences >= 2, 'expects both author and institution soft-delete guards');
  });

  test('rejects invalid institution_id', () => {
    assert.throws(() => buildArticleFilter({ institutionId: '0' }), {
      code: 'INVALID_ENTITY_ID',
      statusCode: 400,
    });

    assert.throws(() => buildArticleFilter({ institutionId: '-3' }), {
      code: 'INVALID_ENTITY_ID',
      statusCode: 400,
    });

    assert.throws(() => buildArticleFilter({ institutionId: 'abc' }), {
      code: 'INVALID_ENTITY_ID',
      statusCode: 400,
    });
  });

  test('institution filter can coexist with vn_universities scope', () => {
    const filter = buildArticleFilter({ institutionId: '7', scope: 'vn_universities', publicationYear: 2024 });

    assert.ok(filter.whereSql.includes('a."is_vn_journal" IS TRUE'), 'expects scope predicate still present');
    assert.ok(filter.values.includes(7));
    assert.ok(filter.values.includes(2024));
  });

  test('topic filter matches primary topic OR Sub_Topic using a single placeholder', () => {
    const filter = buildArticleFilter({ topicId: '9' });

    assert.deepStrictEqual(filter.values, [9]);
    assert.ok(filter.whereSql.includes('a."primary_topic" = $1'));
    assert.ok(filter.whereSql.includes('"Sub_Topic"'));
    assert.ok(filter.whereSql.includes('$1'), 'expects the same placeholder reused for both branches');
    const placeholderOccurrences = filter.whereSql.split('$1').length - 1;
    assert.strictEqual(placeholderOccurrences, 2, 'topic_id value should not be duplicated as a second bound param');
  });

  test('rejects invalid sort order and invalid strict sort field', () => {
    assert.throws(() => normalizeArticleSort('title', 'sideways'), {
      code: 'INVALID_SORT_ORDER',
      statusCode: 400,
    });

    assert.throws(() => normalizeArticleSort('unsafe', 'desc', { throwOnInvalid: true }), {
      code: 'INVALID_SORT_BY',
      statusCode: 400,
    });
  });
});
