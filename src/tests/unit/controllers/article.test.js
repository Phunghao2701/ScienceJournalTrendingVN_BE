import test from 'node:test';
import assert from 'node:assert';
import { mock } from 'node:test';
import request from 'supertest';
import jwt from 'jsonwebtoken';

import app from '../../../app.js';
import pool from '../../../config/database.js';
import * as articleService from '../../../services/article.service.js';

const JWT_SECRET = process.env.JWT_SECRET;
const userId = '11111111-1111-1111-1111-111111111111';
const testToken = jwt.sign({ user_id: userId, role: 'STUDENT', email: 'test@example.com' }, JWT_SECRET);

test.after(async () => {
  await pool.end();
});

test.describe('Article Controller - GET /api/v1/articles Unit Test Suite', () => {

  test.afterEach(() => {
    mock.reset();
  });

  // ==========================================
  // 1. Kiểm tra xác thực (Authentication)
  // ==========================================
  test.describe('Authentication', () => {
    test('Lỗi 401 - Không truyền Token xác thực', async () => {
      const res = await request(app)
        .get('/api/v1/articles?keywords=Machine Learning');

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
    });

    test('Lỗi 401 - Token không hợp lệ', async () => {
      const res = await request(app)
        .get('/api/v1/articles?keywords=Machine Learning')
        .set('Authorization', 'Bearer invalid_token_here');

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
    });

    test('Lỗi 401 - Sai định dạng Authorization header (không có Bearer)', async () => {
      const res = await request(app)
        .get('/api/v1/articles?keywords=Machine Learning')
        .set('Authorization', testToken);

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
    });
  });

  // ==========================================
  // 2. Kiểm tra validation (Input)
  // ==========================================
  test.describe('Validation', () => {

    test('Lỗi 400 - keywords là chuỗi rỗng', async () => {
      const res = await request(app)
        .get('/api/v1/articles?keywords=')
        .set('Authorization', `Bearer ${testToken}`);

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });

    test('Lỗi 400 - keywords chỉ chứa khoảng trắng', async () => {
      const res = await request(app)
        .get('/api/v1/articles?keywords=%20%20%20')
        .set('Authorization', `Bearer ${testToken}`);

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });

    test('Lỗi 400 - keywords chỉ chứa dấu phẩy (tách ra thành mảng rỗng)', async () => {
      const res = await request(app)
        .get('/api/v1/articles?keywords=,,,')
        .set('Authorization', `Bearer ${testToken}`);

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'Danh sách keyword không hợp lệ!');
    });
  });

  // ==========================================
  // 3. Trường hợp thành công
  // ==========================================
  test.describe('Success Cases', () => {
    test('Thành công: Tìm bài báo với 1 keyword', async () => {
      const mockArticles = [
        {
          article_id: 101,
          title: 'Deep Learning for NLP',
          abstract: 'A survey on DL...',
          publication_year: 2024,
          doi: 'https://doi.org/10.1000/ex1',
          created_at: '2024-01-15T00:00:00.000Z'
        }
      ];

      mock.method(pool, 'query', async (sql, params) => {
        if (typeof sql === 'string' && sql.includes('COUNT')) {
          return { rows: [{ total: '1' }] };
        }
        return { rows: mockArticles };
      });

      const res = await request(app)
        .get('/api/v1/articles?keywords=Deep Learning')
        .set('Authorization', `Bearer ${testToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.message, 'Lấy danh sách bài báo thành công!');
      assert.strictEqual(res.body.data.articles.length, 1);
      assert.strictEqual(res.body.data.articles[0].title, 'Deep Learning for NLP');
      assert.strictEqual(res.body.data.pagination.total, 1);
    });

    test('Thành công: Tìm bài báo với nhiều keywords (phân tách bằng dấu phẩy)', async () => {
      const mockArticles = [
        { article_id: 101, title: 'Article 1', abstract: null, publication_year: 2024, doi: null, created_at: null },
        { article_id: 102, title: 'Article 2', abstract: null, publication_year: 2023, doi: null, created_at: null },
        { article_id: 103, title: 'Article 3', abstract: null, publication_year: 2022, doi: null, created_at: null }
      ];

      mock.method(pool, 'query', async (sql, params) => {
        if (typeof sql === 'string' && sql.includes('COUNT')) {
          return { rows: [{ total: '3' }] };
        }
        return { rows: mockArticles };
      });

      const res = await request(app)
        .get('/api/v1/articles?keywords=Machine Learning,Deep Learning,Neural Network')
        .set('Authorization', `Bearer ${testToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.articles.length, 3);
      assert.strictEqual(res.body.data.pagination.total, 3);
    });

    test('Thành công: Trả về mảng rỗng khi không có bài báo phù hợp', async () => {
      mock.method(pool, 'query', async (sql, params) => {
        if (typeof sql === 'string' && sql.includes('COUNT')) {
          return { rows: [{ total: '0' }] };
        }
        return { rows: [] };
      });

      const res = await request(app)
        .get('/api/v1/articles?keywords=xyznonexistentkeyword')
        .set('Authorization', `Bearer ${testToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.articles.length, 0);
      assert.strictEqual(res.body.data.pagination.total, 0);
      assert.strictEqual(res.body.data.pagination.total_pages, 0);
    });
  });

  // ==========================================
  // 4. Phân trang (Pagination)
  // ==========================================
  test.describe('Pagination', () => {
    test('Sử dụng giá trị mặc định khi không truyền limit và page', async () => {
      mock.method(pool, 'query', async (sql, params) => {
        if (typeof sql === 'string' && sql.includes('COUNT')) {
          return { rows: [{ total: '100' }] };
        }
        return { rows: [] };
      });

      const res = await request(app)
        .get('/api/v1/articles?keywords=AI')
        .set('Authorization', `Bearer ${testToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.pagination.page, 1);
      assert.strictEqual(res.body.data.pagination.limit, 20);
      assert.strictEqual(res.body.data.pagination.total, 100);
      assert.strictEqual(res.body.data.pagination.total_pages, 5);
    });

    test('Phân trang đúng khi truyền limit và page tùy chỉnh', async () => {
      let capturedParams = null;

      mock.method(pool, 'query', async (sql, params) => {
        if (typeof sql === 'string' && sql.includes('COUNT')) {
          return { rows: [{ total: '50' }] };
        }
        capturedParams = params;
        return { rows: [] };
      });

      const res = await request(app)
        .get('/api/v1/articles?keywords=AI&limit=10&page=3')
        .set('Authorization', `Bearer ${testToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.pagination.page, 3);
      assert.strictEqual(res.body.data.pagination.limit, 10);
      assert.strictEqual(res.body.data.pagination.total, 50);
      assert.strictEqual(res.body.data.pagination.total_pages, 5);

      // Kiểm tra offset = (page - 1) * limit = (3-1)*10 = 20
      assert.strictEqual(capturedParams[0], 10);  // limit
      assert.strictEqual(capturedParams[1], 20);  // offset
    });
  });

  // ==========================================
  // 5. Xử lý lỗi Server
  // ==========================================
  test.describe('Server Error', () => {
    test('Lỗi 500 - Database query thất bại', async () => {
      mock.method(pool, 'query', async () => {
        throw new Error('Database connection lost');
      });

      const res = await request(app)
        .get('/api/v1/articles?keywords=AI')
        .set('Authorization', `Bearer ${testToken}`);

      assert.strictEqual(res.status, 500);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'Có lỗi xảy ra ở Server!');
    });
  });

  // ==========================================
  // 6. Public API (getArticles)
  // ==========================================
  test.describe('Public API - GET /api/v1/articles', () => {
    test('Thành công: Lấy danh sách bài báo (không cần token, có search query)', async () => {
      const mockArticles = [
        {
          article_id: 1,
          title: 'Public Article',
          abstract: 'Test',
          publication_year: 2025,
          doi: '10.xxxx',
          journal_id: 2,
          journal_name: 'Test Journal'
        }
      ];

      mock.method(pool, 'query', async (sql, params) => {
        if (typeof sql === 'string' && sql.includes('COUNT')) {
          return { rows: [{ total: '1' }] };
        }
        return { rows: mockArticles };
      });

      const res = await request(app)
        .get('/api/v1/articles?search=test');

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.items.length, 1);
      assert.strictEqual(res.body.data.items[0].journal.display_name, 'Test Journal');
      assert.strictEqual(res.body.data.pagination.page, 1);
      assert.strictEqual(res.body.data.pagination.limit, 10);
      assert.strictEqual(res.body.data.pagination.total, 1);
    });

    test('Thành công: Trả về mảng rỗng (không gọi DB) nếu bỏ trống search query', async () => {
      // Mock db query để đảm bảo nó KHÔNG được gọi
      const queryMock = mock.method(pool, 'query', async () => {
        throw new Error('Should not call DB if search is empty');
      });

      const res = await request(app)
        .get('/api/v1/articles');

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.deepStrictEqual(res.body.data.items, []);
      assert.strictEqual(queryMock.mock.callCount(), 0);
    });

    test('Thành công: Trả về mảng rỗng nếu không có dữ liệu', async () => {
      mock.method(pool, 'query', async (sql, params) => {
        if (typeof sql === 'string' && sql.includes('COUNT')) {
          return { rows: [{ total: '0' }] };
        }
        return { rows: [] };
      });

      const res = await request(app)
        .get('/api/v1/articles?search=NON_EXISTENT');

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.deepStrictEqual(res.body.data.items, []);
      assert.strictEqual(res.body.data.pagination.total, 0);
    });

    test('Không bị lỗi khi page, limit truyền sai định dạng (sử dụng mặc định)', async () => {
      let capturedParams = null;
      mock.method(pool, 'query', async (sql, params) => {
        if (typeof sql === 'string' && sql.includes('COUNT')) {
          return { rows: [{ total: '0' }] };
        }
        capturedParams = params;
        return { rows: [] };
      });

      const res = await request(app)
        .get('/api/v1/articles?page=abc&limit=-5&search=test');

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.pagination.page, 1);
      assert.strictEqual(res.body.data.pagination.limit, 10);
      
      // params truyền vào SQL: search ($1), limit ($2) = 10, offset ($3) = 0
      assert.strictEqual(capturedParams[1], 10);
      assert.strictEqual(capturedParams[2], 0);
    });
  });
});
