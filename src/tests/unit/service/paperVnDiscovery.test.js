import test from 'node:test';
import assert from 'node:assert';
import { mock } from 'node:test';

import pool from '../../../config/database.js';
import { getAuthorById } from '../../../services/author.service.js';
import { getJournals } from '../../../services/journal.service.js';
import { getKeywordById } from '../../../services/keyword.service.js';
import { getArticlesByKeyword } from '../../../services/keyword.service.js';
import {
  countArticlesByTopicId,
  getArticlesByTopicId,
} from '../../../services/topic.service.js';

test.after(async () => {
  await pool.end();
});

test.afterEach(() => {
  mock.reset();
});

test('journal search matches ISSN with hyphen-insensitive predicate', async () => {
  const queries = [];
  mock.method(pool, 'query', async (sql) => {
    queries.push(sql);
    if (sql.includes('COUNT')) return { rows: [{ total: 1 }] };
    return { rows: [{ journal_id: '1', display_name: 'ISSN Journal', issn: '1234-5678' }] };
  });

  const result = await getJournals({ search: '12345678' });

  assert.strictEqual(result.total, 1);
  assert.ok(queries[0].includes('j.issn ILIKE'));
  assert.ok(queries[0].includes("REPLACE(j.issn, '-', '') ILIKE"));
});

test('keyword article endpoint applies vn_universities scope predicate', async () => {
  const calls = [];
  mock.method(pool, 'query', async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('COUNT')) return { rows: [{ total: '1' }] };
    return { rows: [{ article_id: 1, title: 'Paper VN' }] };
  });

  const result = await getArticlesByKeyword(7, { scope: 'vn_universities' });

  assert.strictEqual(result.scope, 'vn_universities');
  assert.ok(calls.every(call => call.sql.includes('"Institution_Author"')));
  assert.ok(calls.every(call => call.sql.includes('scope_ia."year" = a."publication_year"')));
  assert.ok(calls[1].sql.includes('p."display_name" AS "publisher_name"'));
  assert.ok(calls[1].sql.includes('a."citation_count"'));
  assert.ok(calls[1].sql.includes('a."reference_count"'));
  assert.ok(calls[1].sql.includes('json_agg(json_build_object'));
  assert.ok(!calls[1].sql.includes('0 AS citations_count'));
  assert.deepStrictEqual(calls[0].params.slice(0, 2), [['VN'], ['education']]);
  assert.strictEqual(calls[0].params[2], 7);
});

test('topic article endpoint applies scope to list and count queries', async () => {
  const calls = [];
  mock.method(pool, 'query', async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('COUNT')) return { rows: [{ total: '1' }] };
    return { rows: [{ article_id: 2, title: 'Topic VN' }] };
  });

  const [articles, total] = await Promise.all([
    getArticlesByTopicId(3, 10, 0, { scope: 'vn_universities', sortBy: 'title', sortOrder: 'asc' }),
    countArticlesByTopicId(3, { scope: 'vn_universities' }),
  ]);

  assert.strictEqual(articles.length, 1);
  assert.strictEqual(total, 1);
  assert.ok(calls.every(call => call.sql.includes('"Institution_Author"')));
  assert.ok(calls.every(call => call.sql.includes('scope_ia."year" = a."publication_year"')));
  const listCall = calls.find(call => !call.sql.includes('COUNT'));
  assert.ok(listCall.sql.includes('p."display_name" AS "publisher_name"'));
  assert.ok(listCall.sql.includes('a."citation_count"'));
  assert.ok(listCall.sql.includes('a."reference_count"'));
  assert.ok(listCall.sql.includes('json_agg(json_build_object'));
});

test('author by-id endpoint exposes stable ID and display name', async () => {
  let capturedSql = null;
  mock.method(pool, 'query', async (sql, params) => {
    capturedSql = sql;
    assert.deepStrictEqual(params, [42]);
    return { rows: [{ author_id: '42', display_name: 'Author Label' }] };
  });

  const result = await getAuthorById(42);

  assert.strictEqual(result.author_id, '42');
  assert.strictEqual(result.display_name, 'Author Label');
  assert.ok(capturedSql.includes('author_id::text AS author_id'));
  assert.ok(capturedSql.includes('COALESCE(is_deleted, false) = false'));
});

test('keyword by-id endpoint exposes stable ID and display name', async () => {
  let capturedSql = null;
  mock.method(pool, 'query', async (sql, params) => {
    capturedSql = sql;
    assert.deepStrictEqual(params, [7]);
    return { rows: [{ keyword_id: '7', display_name: 'Keyword Label' }] };
  });

  const result = await getKeywordById(7);

  assert.strictEqual(result.keyword_id, '7');
  assert.strictEqual(result.display_name, 'Keyword Label');
  assert.ok(capturedSql.includes('keyword_id::text AS keyword_id'));
});
