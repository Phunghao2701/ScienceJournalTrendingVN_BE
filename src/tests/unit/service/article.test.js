import test from 'node:test';
import assert from 'node:assert';
import { mock } from 'node:test';
import pool from '../../../config/database.js';
import { getArticlesByKeywords, countArticlesByKeywords, getAllArticles, countAllArticles } from '../../../services/article.service.js';

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
      assert.strictEqual(capturedParams[0], 10);  // limit
      assert.strictEqual(capturedParams[1], 30);  // offset
      assert.strictEqual(capturedParams[2], 'ai'); // keyword
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
      assert.strictEqual(capturedParams[0], 5);   // limit
      assert.strictEqual(capturedParams[1], 0);   // offset
      assert.strictEqual(capturedParams[2], 'machine learning');
      assert.strictEqual(capturedParams[3], 'deep learning');
      assert.strictEqual(capturedParams[4], 'neural network');
      // SQL phải chứa $3, $4, $5 cho 3 keywords
      assert.ok(capturedSql.includes('$3'));
      assert.ok(capturedSql.includes('$4'));
      assert.ok(capturedSql.includes('$5'));
    });

    test('Sử dụng giá trị mặc định khi không truyền limit và offset', async () => {
      let capturedParams = null;

      mock.method(pool, 'query', async (sql, params) => {
        capturedParams = params;
        return { rows: [] };
      });

      await getArticlesByKeywords(['ai']);

      // Mặc định: limit = 20, offset = 0
      assert.strictEqual(capturedParams[0], 20);
      assert.strictEqual(capturedParams[1], 0);
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
      mock.method(pool, 'query', async (sql, params) => {
        capturedParams = params;
        return { rows: mockArticles };
      });

      const result = await getAllArticles({});

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].title, 'Test Article');
      assert.strictEqual(result[0].journal_name, 'Test Journal');
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

      assert.ok(capturedSql.includes('WHERE a."title" ILIKE $1'));
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
      assert.ok(capturedSql.includes('WHERE a."title" ILIKE $1'));
      assert.deepStrictEqual(capturedParams, ['%machine learning%']);
    });
  });
});
