import test from 'node:test';
import assert from 'node:assert';
import { mock } from 'node:test';
import pool from '../../../config/database.js';
import {
  getArticlesByKeywords,
  countArticlesByKeywords,
  getAllArticles,
  countAllArticles,
  getArticleAnalytics,
  getArticleById,
  getArticleCitingWorksAnalytics,
} from '../../../services/article.service.js';

test.after(async () => {
  await pool.end();
});

test.describe('Article Service - getArticlesByKeywords() Unit Test Suite', () => {

  test.afterEach(() => {
    mock.reset();
  });

  // ==========================================
  // 1. getArticlesByKeywords
  // ==========================================
  test.describe('getArticlesByKeywords()', () => {

    test('Trả về danh sách bài báo khi tìm thấy keyword phù hợp', async () => {
      const mockArticles = [
        {
          article_id: 101,
          title: 'Deep Learning for Natural Language Processing',
          abstract: 'A comprehensive survey...',
          publication_year: 2024,
          doi: 'https://doi.org/10.1000/example1',
          created_at: '2024-01-15T00:00:00.000Z'
        },
        {
          article_id: 102,
          title: 'Machine Learning in Healthcare',
          abstract: 'Applications of ML...',
          publication_year: 2023,
          doi: 'https://doi.org/10.1000/example2',
          created_at: '2023-06-20T00:00:00.000Z'
        }
      ];

      mock.method(pool, 'query', async (sql, params) => {
        return { rows: mockArticles };
      });

      const result = await getArticlesByKeywords(['machine learning', 'deep learning'], 20, 0);

      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].title, 'Deep Learning for Natural Language Processing');
      assert.strictEqual(result[1].title, 'Machine Learning in Healthcare');
    });

    test('Trả về mảng rỗng khi không tìm thấy bài báo nào', async () => {
      mock.method(pool, 'query', async (sql, params) => {
        return { rows: [] };
      });

      const result = await getArticlesByKeywords(['nonexistent keyword'], 20, 0);

      assert.strictEqual(result.length, 0);
      assert.deepStrictEqual(result, []);
    });

    test('Truyền đúng tham số limit và offset vào query', async () => {
      let capturedParams = null;

      mock.method(pool, 'query', async (sql, params) => {
        capturedParams = params;
        return { rows: [] };
      });

      await getArticlesByKeywords(['ai'], 10, 30);

      // params: [limit, offset, ...keywords]
      assert.strictEqual(capturedParams[0], 'ai'); // keyword
      assert.strictEqual(capturedParams.at(-2), 10);  // limit
      assert.strictEqual(capturedParams.at(-1), 30);  // offset
    });

    test('Truyền đúng nhiều keywords vào placeholders', async () => {
      let capturedParams = null;
      let capturedSql = null;

      mock.method(pool, 'query', async (sql, params) => {
        capturedParams = params;
        capturedSql = sql;
        return { rows: [] };
      });

      await getArticlesByKeywords(['machine learning', 'deep learning', 'neural network'], 5, 0);

      // params: [limit, offset, kw1, kw2, kw3]
      assert.strictEqual(capturedParams.length, 5);
      assert.strictEqual(capturedParams[0], 'machine learning');
      assert.strictEqual(capturedParams[1], 'deep learning');
      assert.strictEqual(capturedParams[2], 'neural network');
      assert.strictEqual(capturedParams[3], 5);   // limit
      assert.strictEqual(capturedParams[4], 0);   // offset
      // SQL phải chứa $3, $4, $5 cho 3 keywords
      assert.ok(capturedSql.includes('$3'));
      assert.ok(capturedSql.includes('$4'));
      assert.ok(capturedSql.includes('LIMIT $4 OFFSET $5'));
    });

    test('Sử dụng giá trị mặc định khi không truyền limit và offset', async () => {
      let capturedParams = null;

      mock.method(pool, 'query', async (sql, params) => {
        capturedParams = params;
        return { rows: [] };
      });

      await getArticlesByKeywords(['ai']);

      // Mặc định: limit = 20, offset = 0
      assert.strictEqual(capturedParams.at(-2), 20);
      assert.strictEqual(capturedParams.at(-1), 0);
    });

    test('Ném lỗi khi database query thất bại', async () => {
      mock.method(pool, 'query', async () => {
        throw new Error('Connection refused');
      });

      await assert.rejects(
        async () => await getArticlesByKeywords(['ai'], 20, 0),
        { message: 'Connection refused' }
      );
    });
  });

  // ==========================================
  // 2. countArticlesByKeywords
  // ==========================================
  test.describe('countArticlesByKeywords()', () => {

    test('Trả về tổng số bài báo phù hợp', async () => {
      mock.method(pool, 'query', async (sql, params) => {
        return { rows: [{ total: '42' }] };
      });

      const total = await countArticlesByKeywords(['machine learning']);

      assert.strictEqual(total, 42);
      assert.strictEqual(typeof total, 'number');
    });

    test('Trả về 0 khi không tìm thấy bài báo nào', async () => {
      mock.method(pool, 'query', async (sql, params) => {
        return { rows: [{ total: '0' }] };
      });

      const total = await countArticlesByKeywords(['nonexistent']);

      assert.strictEqual(total, 0);
    });

    test('Truyền đúng keywords vào tham số query (không có limit/offset)', async () => {
      let capturedParams = null;

      mock.method(pool, 'query', async (sql, params) => {
        capturedParams = params;
        return { rows: [{ total: '0' }] };
      });

      await countArticlesByKeywords(['ai', 'robotics']);

      // countArticlesByKeywords chỉ truyền keywords, không có limit/offset
      assert.strictEqual(capturedParams.length, 2);
      assert.strictEqual(capturedParams[0], 'ai');
      assert.strictEqual(capturedParams[1], 'robotics');
    });

    test('SQL chứa đúng số placeholder tương ứng với số keywords', async () => {
      let capturedSql = null;

      mock.method(pool, 'query', async (sql, params) => {
        capturedSql = sql;
        return { rows: [{ total: '0' }] };
      });

      await countArticlesByKeywords(['a', 'b', 'c']);

      assert.ok(capturedSql.includes('$1'));
      assert.ok(capturedSql.includes('$2'));
      assert.ok(capturedSql.includes('$3'));
    });

    test('Ném lỗi khi database query thất bại', async () => {
      mock.method(pool, 'query', async () => {
        throw new Error('Database timeout');
      });

      await assert.rejects(
        async () => await countArticlesByKeywords(['ai']),
        { message: 'Database timeout' }
      );
    });
  });

  // ==========================================
  // 3. getAllArticles
  // ==========================================
  test.describe('getAllArticles()', () => {

    test('Trả về danh sách bài báo với các giá trị mặc định', async () => {
      const mockArticles = [
        {
          article_id: 1,
          title: 'Test Article',
          abstract: 'Abstract',
          publication_year: 2025,
          doi: '10.test',
          journal_id: 5,
          journal_name: 'Test Journal'
        }
      ];

      let capturedParams = null;
      let capturedSql = null;
      mock.method(pool, 'query', async (sql, params) => {
        capturedSql = sql;
        capturedParams = params;
        return { rows: mockArticles };
      });

      const result = await getAllArticles({});

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].title, 'Test Article');
      assert.strictEqual(result[0].journal_name, 'Test Journal');
      assert.ok(capturedSql.includes('a."is_open_access" AS "is_open_access"'));
      assert.ok(!capturedSql.includes('COALESCE(j."is_open_access", false) AS "is_open_access"'));
      assert.deepStrictEqual(capturedParams, [10, 0]);
    });

    test('Tìm kiếm theo title khi có tham số search', async () => {
      let capturedSql = null;
      let capturedParams = null;

      mock.method(pool, 'query', async (sql, params) => {
        capturedSql = sql;
        capturedParams = params;
        return { rows: [] };
      });

      await getAllArticles({ limit: 5, offset: 10, search: 'cancer' });

      assert.ok(capturedSql.includes('a."title" ILIKE $1'));
      assert.ok(capturedSql.includes('j."display_name" ILIKE $1'));
      assert.ok(capturedSql.includes('j."issn" ILIKE $1'));
      assert.ok(capturedSql.includes('FROM "Publisher" search_publisher'));
      assert.ok(capturedSql.includes('FROM "Author_Article" search_aa'));
      assert.ok(capturedSql.includes('FROM "Keyword_Article" search_ka'));
      assert.ok(capturedSql.includes('FROM "Topic" search_primary_topic'));
      assert.ok(capturedSql.includes('FROM "Sub_Topic" search_st'));
      assert.ok(capturedSql.includes('LIMIT $2 OFFSET $3'));
      assert.deepStrictEqual(capturedParams, ['%cancer%', 5, 10]);
    });
  });

  // ==========================================
  // 4. countAllArticles
  // ==========================================
  test.describe('countAllArticles()', () => {

    test('Đếm tổng số bài báo khi không có tham số search', async () => {
      let capturedParams = null;
      mock.method(pool, 'query', async (sql, params) => {
        capturedParams = params;
        return { rows: [{ total: '150' }] };
      });

      const total = await countAllArticles({});

      assert.strictEqual(total, 150);
      assert.deepStrictEqual(capturedParams, []);
    });

    test('Đếm bài báo với tham số search', async () => {
      let capturedSql = null;
      let capturedParams = null;

      mock.method(pool, 'query', async (sql, params) => {
        capturedSql = sql;
        capturedParams = params;
        return { rows: [{ total: '5' }] };
      });

      const total = await countAllArticles({ search: 'machine learning' });

      assert.strictEqual(total, 5);
      assert.ok(capturedSql.includes('a."title" ILIKE $1'));
      assert.ok(capturedSql.includes('j."display_name" ILIKE $1'));
      assert.ok(capturedSql.includes('FROM "Publisher" search_publisher'));
      assert.ok(capturedSql.includes('FROM "Author_Article" search_aa'));
      assert.ok(capturedSql.includes('FROM "Keyword_Article" search_ka'));
      assert.ok(capturedSql.includes('FROM "Sub_Topic" search_st'));
      assert.deepStrictEqual(capturedParams, ['%machine learning%']);
    });
  });

  test.describe('getArticleAnalytics()', () => {
    test('trả về contract analytics ổn định cho top entities và access distribution', async () => {
      const capturedSql = [];
      const rowsByCall = [
        [{ totalArticles: 8, openAccessCount: 3, closedAccessCount: 4, unknownAccessCount: 1 }],
        [{ year: 2024, count: 8 }],
        [{ publisher_id: '11', display_name: 'Publisher A', article_count: 4 }],
        [{ author_id: '22', display_name: 'Author A', article_count: 3 }],
        [{ topic_id: '33', display_name: 'Topic A', article_count: 2 }],
        [{ institution_id: '44', display_name: 'VN University', article_count: 2 }],
        [{ keyword_id: '55', display_name: 'Keyword A', article_count: 5 }],
      ];
      let callIndex = 0;

      mock.method(pool, 'query', async (sql, params) => {
        capturedSql.push(sql);
        return { rows: rowsByCall[callIndex++] };
      });

      const result = await getArticleAnalytics({ scope: 'vn_universities', publisherId: 11 });

      assert.strictEqual(result.scope, 'vn_universities');
      assert.deepStrictEqual(result.totals, {
        totalArticles: 8,
        openAccessCount: 3,
        closedAccessCount: 4,
        unknownAccessCount: 1,
      });
      assert.deepStrictEqual(result.topPublishers[0], {
        publisher_id: '11',
        display_name: 'Publisher A',
        article_count: 4,
      });
      assert.deepStrictEqual(result.topAuthors[0], {
        author_id: '22',
        display_name: 'Author A',
        article_count: 3,
      });
      assert.deepStrictEqual(result.topTopics[0], {
        topic_id: '33',
        display_name: 'Topic A',
        article_count: 2,
      });
      assert.deepStrictEqual(result.yearDistribution[0], {
        year: 2024,
        count: 8,
      });
      assert.deepStrictEqual(result.topInstitutions[0], {
        institution_id: '44',
        display_name: 'VN University',
        article_count: 2,
      });
      assert.deepStrictEqual(result.topKeywords[0], {
        keyword_id: '55',
        display_name: 'Keyword A',
        article_count: 5,
      });
      assert.deepStrictEqual(result.accessDistribution, [
        { key: 'oa', label: 'Open access', count: 3 },
        { key: 'closed', label: 'Closed access', count: 4 },
        { key: 'unknown', label: 'Unknown', count: 1 },
      ]);

      assert.ok(capturedSql[0].includes('a."is_open_access" IS TRUE'));
      assert.ok(capturedSql[0].includes('a."is_open_access" IS FALSE'));
      assert.ok(capturedSql[0].includes('a."is_open_access" IS NULL'));
      assert.ok(!capturedSql[0].includes('j."is_open_access"'));
      assert.ok(capturedSql[2].includes('AS "display_name"'));
      assert.ok(capturedSql[2].includes('AS "article_count"'));
      assert.ok(capturedSql[2].includes('p."publisher_id" IS NOT NULL'));
      assert.ok(capturedSql[3].includes('AS "display_name"'));
      assert.ok(capturedSql[3].includes('AS "article_count"'));
      assert.ok(capturedSql[4].includes('t."topic_id" IS NOT NULL'));
      assert.ok(capturedSql[5].includes('"Institution_Author"'));
      assert.ok(capturedSql[5].includes('ia."year" = fa."publication_year"'));
      assert.ok(capturedSql[5].includes('UPPER(TRIM(inst."country_code")) = \'VN\''));
      assert.ok(capturedSql[6].includes('"Keyword_Article"'));
      assert.ok(capturedSql[6].includes('JOIN "Keyword" k'));
    });
  });

  test.describe('getArticleById()', () => {
    test('projects imported metrics, relation counts and exact-year author institutions', async () => {
      const calls = [];
      const rowsByCall = [
        [{
          article_id: '10',
          title: 'Lens Detail Paper',
          publication_year: 2024,
          citation_count: 12,
          reference_count: 34,
          citing_works_count: 5,
          available_references_count: 7,
          journal_issn: '1234-5678',
        }],
        [{
          author_id: '99',
          display_name: 'Author A',
          orcid: null,
          institutions: [{
            institution_id: '15',
            display_name: 'Vietnam University',
            country_code: 'VN',
            type: 'education',
          }],
        }],
        [{ keyword_id: '1', display_name: 'AI', score: 0.9 }],
        [{ topic_id: '2', display_name: 'Machine Learning', is_primary: true }],
      ];
      let callIndex = 0;

      mock.method(pool, 'query', async (sql, params) => {
        calls.push({ sql, params });
        return { rows: rowsByCall[callIndex++] };
      });

      const result = await getArticleById(10);

      assert.strictEqual(result.citation_count, 12);
      assert.strictEqual(result.reference_count, 34);
      assert.strictEqual(result.citing_works_count, 5);
      assert.strictEqual(result.available_references_count, 7);
      assert.deepStrictEqual(result.authors[0].institutions[0], {
        institution_id: '15',
        display_name: 'Vietnam University',
        country_code: 'VN',
        type: 'education',
      });
      assert.deepStrictEqual(result.institutions, result.authors[0].institutions);
      assert.ok(calls[0].sql.includes('AS "citing_works_count"'));
      assert.ok(calls[0].sql.includes('AS "available_references_count"'));
      assert.ok(calls[1].sql.includes('"Institution_Author"'));
      assert.ok(calls[1].sql.includes('ia."year" = $2'));
      assert.ok(calls[1].sql.includes('COALESCE(inst."is_deleted", false) = false'));
      assert.deepStrictEqual(calls[1].params, [10, 2024]);
    });
  });

  test.describe('getArticleCitingWorksAnalytics()', () => {
    test('returns all-row total and year distribution ordered by publication year', async () => {
      const calls = [];
      const rowsByCall = [
        [{ total: 5 }],
        [
          { year: 2021, count: 1 },
          { year: 2022, count: 3 },
          { year: null, count: 1 },
        ],
      ];
      let callIndex = 0;

      mock.method(pool, 'query', async (sql, params) => {
        calls.push({ sql, params });
        return { rows: rowsByCall[callIndex++] };
      });

      const result = await getArticleCitingWorksAnalytics(10);

      assert.strictEqual(result.total, 5);
      assert.deepStrictEqual(result.year_distribution, rowsByCall[1]);
      assert.ok(calls[1].sql.includes('GROUP BY "publication_year"'));
      assert.ok(calls[1].sql.includes('ORDER BY "publication_year" ASC NULLS LAST'));
      assert.deepStrictEqual(calls[0].params, [10]);
      assert.deepStrictEqual(calls[1].params, [10]);
    });
  });
});
