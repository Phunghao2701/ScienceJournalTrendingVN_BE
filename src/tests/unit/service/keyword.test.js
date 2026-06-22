import { describe, test, afterEach, after, mock } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import jwt from 'jsonwebtoken';

import app from '../../../app.js';
import pool from '../../../config/database.js';
import {
  getTrendingKeywords,
  getWatchedKeywordArticles,
} from '../../../controllers/keyword.controller.js';
import * as keywordService from '../../../services/keyword.service.js';

const JWT_SECRET = process.env.JWT_SECRET;
const userId = 'a8e9c612-40db-4ff0-87a0-0f8b3b4f6cf7';
const testToken = jwt.sign({ user_id: userId, role: 'STUDENT', email: 'test@example.com' }, JWT_SECRET);

after(async () => {
  await pool.end();
});

// ============================================================
// Helper: Tạo mock Response object cho unit test
// ============================================================
const createMockResponse = () => {
  const res = {};
  res.status = (statusCode) => {
    res.statusCode = statusCode;
    return res;
  };
  res.json = (jsonData) => {
    res.body = jsonData;
    return res;
  };
  return res;
};

// ============================================================
// 1. POST /api/v1/projects/:id/keywords/watch (Integration Test)
// ============================================================
describe('Keyword Controller - POST /api/v1/projects/:id/keywords/watch', () => {

  afterEach(() => {
    mock.restoreAll();
  });

  // ==========================================
  // 1.1 Kiểm tra xác thực (Authentication)
  // ==========================================
  describe('Authentication', () => {
    test('Lỗi 401 - Không truyền Token xác thực', async () => {
      const res = await request(app)
        .post('/api/v1/projects/1/keywords/watch')
        .send({ keyword_ids: [1] });

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
    });
  });

  // ==========================================
  // 1.2 Kiểm tra validation (Input)
  // ==========================================
  describe('Validation', () => {
    test('Lỗi 400 - Project ID không hợp lệ', async () => {
      const res = await request(app)
        .post('/api/v1/projects/abc/keywords/watch')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ keyword_ids: [1] });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'ID dự án không hợp lệ');
    });

    test('Lỗi 400 - keyword_ids không tồn tại hoặc không phải mảng', async () => {
      const res = await request(app)
        .post('/api/v1/projects/1/keywords/watch')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ keyword_ids: "not_array" });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'keyword_ids phải là một mảng');
    });

    test('Lỗi 400 - keyword_ids chứa phần tử không hợp lệ (số âm, chuỗi)', async () => {
      const res = await request(app)
        .post('/api/v1/projects/1/keywords/watch')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ keyword_ids: [1, -5, "abc"] });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'Các phần tử trong keyword_ids phải là số nguyên dương');
    });

    test('Lỗi 404 - Project không tồn tại hoặc không phải chủ sở hữu', async () => {
      mock.method(keywordService, 'checkProjectOwnership', async () => false);

      const res = await request(app)
        .post('/api/v1/projects/1/keywords/watch')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ keyword_ids: [1] });

      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'Không tìm thấy dự án hoặc bạn không có quyền truy cập dự án này');
    });

    test('Lỗi 400 - Keyword ID không tồn tại trong DB', async () => {
      mock.method(keywordService, 'checkProjectOwnership', async () => true);
      mock.method(keywordService, 'validateKeywordIds', async () => false);

      const res = await request(app)
        .post('/api/v1/projects/1/keywords/watch')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ keyword_ids: [1] });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'Một hoặc nhiều Keyword ID không tồn tại trong hệ thống');
    });
  });

  // ==========================================
  // 1.3 Trường hợp thành công
  // ==========================================
  describe('Success Cases', () => {
    test('Thành công (201) - Cập nhật list keywords hợp lệ', async () => {
      mock.method(keywordService, 'checkProjectOwnership', async () => true);
      mock.method(keywordService, 'validateKeywordIds', async () => true);
      mock.method(keywordService, 'syncWatchedKeywords', async () => true);

      const res = await request(app)
        .post('/api/v1/projects/1/keywords/watch')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ keyword_ids: [1, 2, 3] });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.message, 'Cập nhật danh sách từ khóa theo dõi thành công');
    });

    test('Thành công (201) - Gửi mảng rỗng (unwatch all)', async () => {
      mock.method(keywordService, 'checkProjectOwnership', async () => true);
      mock.method(keywordService, 'syncWatchedKeywords', async () => true);

      const res = await request(app)
        .post('/api/v1/projects/1/keywords/watch')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ keyword_ids: [] });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
    });
  });

  // ==========================================
  // 1.4 Lỗi hệ thống
  // ==========================================
  describe('Server Error', () => {
    test('Lỗi 500 - Exception trong DB query', async () => {
      mock.method(keywordService, 'checkProjectOwnership', async () => {
        throw new Error('Database connection lost');
      });

      const res = await request(app)
        .post('/api/v1/projects/1/keywords/watch')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ keyword_ids: [1] });

      assert.strictEqual(res.status, 500);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'Có lỗi xảy ra ở Server!');
    });
  });
});

// ============================================================
// 2. getTrendingKeywords (Unit Test)
// ============================================================
describe('Keyword Controller - getTrendingKeywords()', () => {

  afterEach(() => {
    mock.restoreAll();
  });

  test('Thất bại: Trả về 400 nếu projectId không hợp lệ', async () => {
    const req = { params: { id: 'abc' }, query: {} };
    const res = createMockResponse();

    await getTrendingKeywords(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.message, 'ID dự án không hợp lệ');
  });

  test('Thành công: Trả về 200 và danh sách keywords với params mặc định', async () => {
    const mockResult = {
      total: 2,
      sort_by: 'count',
      keywords: [
        { id: 1, keyword: 'Machine Learning', count: 45, avg_score: 0.85, total_score: 38.25 },
        { id: 2, keyword: 'Deep Learning', count: 38, avg_score: 0.79, total_score: 30.02 },
      ],
    };

    mock.method(keywordService, 'getTrendingKeywords', async () => mockResult);

    const req = { params: { id: '1' }, query: {} };
    const res = createMockResponse();

    await getTrendingKeywords(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.total, 2);
    assert.strictEqual(res.body.data.sort_by, 'count');
    assert.ok(Array.isArray(res.body.data.keywords));
  });

  test('Thành công: sort_by=score', async () => {
    const mockResult = { total: 2, sort_by: 'score', keywords: [] };
    mock.method(keywordService, 'getTrendingKeywords', async () => mockResult);

    const req = { params: { id: '1' }, query: { sort_by: 'score' } };
    const res = createMockResponse();

    await getTrendingKeywords(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.data.sort_by, 'score');
  });

  test('Thành công: Mảng rỗng khi không có data', async () => {
    const mockResult = { total: 0, keywords: [] };
    mock.method(keywordService, 'getTrendingKeywords', async () => mockResult);

    const req = { params: { id: '999999' }, query: {} };
    const res = createMockResponse();

    await getTrendingKeywords(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.data.total, 0);
    assert.deepStrictEqual(res.body.data.keywords, []);
  });

  test('Thất bại: Trả về 500 khi service throw lỗi', async () => {
    mock.method(keywordService, 'getTrendingKeywords', async () => {
      throw new Error('DB Error');
    });

    const req = { params: { id: '1' }, query: {} };
    const res = createMockResponse();

    await getTrendingKeywords(req, res);

    assert.strictEqual(res.statusCode, 500);
    assert.strictEqual(res.body.success, false);
  });
});

// ============================================================
// 3. getWatchedKeywordArticles (Unit Test)
// ============================================================
describe('Keyword Controller - getWatchedKeywordArticles()', () => {
  const MOCK_USER_ID = '0028ddd0-d305-4aa1-8baa-2b1a2893c883';

  afterEach(() => {
    mock.restoreAll();
  });

  test('Thất bại: Trả về 400 nếu projectId không hợp lệ', async () => {
    const req = {
      params: { id: 'abc' },
      query: {},
      user: { user_id: MOCK_USER_ID },
    };
    const res = createMockResponse();

    await getWatchedKeywordArticles(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.message, 'ID dự án không hợp lệ');
  });

  test('Thành công: Trả về 200 và danh sách bài báo với params mặc định', async () => {
    const mockResult = {
      page: 1,
      limit: 10,
      total: 2,
      total_pages: 1,
      data: [
        { article_id: 1, title: 'Deep Learning in Medicine', publication_year: 2024, doi: '10.1234/abc', matched_keywords: ['Medicine'] },
        { article_id: 2, title: 'Cancer Research', publication_year: 2023, doi: '10.5678/def', matched_keywords: ['Cancer'] },
      ],
    };

    mock.method(keywordService, 'getWatchedKeywordArticles', async () => mockResult);

    const req = {
      params: { id: '1' },
      query: {},
      user: { user_id: MOCK_USER_ID },
    };
    const res = createMockResponse();

    await getWatchedKeywordArticles(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.strictEqual(res.body.pagination.page, 1);
    assert.strictEqual(res.body.pagination.limit, 10);
  });

  test('Thành công: Mảng rỗng khi không có keyword nào được theo dõi', async () => {
    const mockResult = {
      page: 1,
      limit: 10,
      total: 0,
      total_pages: 0,
      data: [],
    };
    mock.method(keywordService, 'getWatchedKeywordArticles', async () => mockResult);

    const req = {
      params: { id: '999999' },
      query: {},
      user: { user_id: MOCK_USER_ID },
    };
    const res = createMockResponse();

    await getWatchedKeywordArticles(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.deepStrictEqual(res.body.data, []);
  });

  test('Thành công: Pagination đúng khi truyền page=2&limit=5', async () => {
    const mockResult = {
      page: 2,
      limit: 5,
      total: 12,
      total_pages: 3,
      data: [],
    };
    mock.method(keywordService, 'getWatchedKeywordArticles', async () => mockResult);

    const req = {
      params: { id: '1' },
      query: { page: '2', limit: '5' },
      user: { user_id: MOCK_USER_ID },
    };
    const res = createMockResponse();

    await getWatchedKeywordArticles(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.pagination.page, 2);
    assert.strictEqual(res.body.pagination.limit, 5);
  });

  test('Thất bại: Trả về 500 khi service throw lỗi', async () => {
    mock.method(keywordService, 'getWatchedKeywordArticles', async () => {
      throw new Error('DB Error');
    });

    const req = {
      params: { id: '1' },
      query: {},
      user: { user_id: MOCK_USER_ID },
    };
    const res = createMockResponse();

    await getWatchedKeywordArticles(req, res);

    assert.strictEqual(res.statusCode, 500);
    assert.strictEqual(res.body.success, false);
  });
});

// ============================================================
// Keyword Service - removeWatchedKeyword (Unit Test)
// ============================================================
describe('Keyword Service - removeWatchedKeyword()', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  test('Thành công: Trả về true khi xóa dữ liệu thành công', async () => {
    mock.method(pool, 'query', async () => ({ rowCount: 1 }));
    
    const result = await keywordService.removeWatchedKeyword(1, 2);
    
    assert.strictEqual(result, true);
  });

  test('Thành công: Trả về false khi không có dữ liệu để xóa', async () => {
    mock.method(pool, 'query', async () => ({ rowCount: 0 }));
    
    const result = await keywordService.removeWatchedKeyword(1, 999);
    
    assert.strictEqual(result, false);
  });

  test('Thất bại: Throw lỗi khi database gặp sự cố', async () => {
    mock.method(pool, 'query', async () => {
      throw new Error('Database Error');
    });
    
    try {
      await keywordService.removeWatchedKeyword(1, 2);
      assert.fail('Đáng lẽ phải throw error');
    } catch (err) {
      assert.strictEqual(err.message, 'Database Error');
    }
  });
});

// ============================================================
// Keyword Service - replaceWatchedKeywords (Unit Test)
// ============================================================
describe('Keyword Service - replaceWatchedKeywords()', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  test('Thành công: Commit khi truyền mảng rỗng (xóa tất cả)', async () => {
    const mockClient = {
      query: mock.fn(async () => ({ rows: [] })),
      release: mock.fn(),
    };
    mock.method(pool, 'connect', async () => mockClient);

    const result = await keywordService.replaceWatchedKeywords(1, []);

    assert.strictEqual(result, true);
    assert.strictEqual(mockClient.query.mock.calls.length, 3); // BEGIN, DELETE, COMMIT
    assert.strictEqual(mockClient.release.mock.calls.length, 1);
  });

  test('Thành công: Xóa cũ, insert mới hợp lệ', async () => {
    const mockClient = {
      query: mock.fn(async (queryStr) => {
        if (queryStr.includes('SELECT keyword_id FROM "Keyword"')) {
          return { rows: [{ keyword_id: '1' }, { keyword_id: '3' }] };
        }
        return { rows: [] };
      }),
      release: mock.fn(),
    };
    mock.method(pool, 'connect', async () => mockClient);

    // Truyền [1, 2, 3] nhưng giả lập DB chỉ trả về 1 và 3 hợp lệ
    const result = await keywordService.replaceWatchedKeywords(1, [1, 2, 3]);

    assert.strictEqual(result, true);
    // BEGIN(1) + DELETE(1) + SELECT(1) + INSERT(2) + COMMIT(1) = 6 queries
    assert.strictEqual(mockClient.query.mock.calls.length, 6);
  });

  test('Thất bại: Rollback khi gặp lỗi DB', async () => {
    const mockClient = {
      query: mock.fn(async (queryStr) => {
        if (queryStr === 'BEGIN') return;
        throw new Error('Fake DB Error');
      }),
      release: mock.fn(),
    };
    mock.method(pool, 'connect', async () => mockClient);

    try {
      await keywordService.replaceWatchedKeywords(1, [1]);
      assert.fail('Đáng lẽ phải throw error');
    } catch (err) {
      assert.strictEqual(err.message, 'Fake DB Error');
      // BEGIN(1), error on DELETE, ROLLBACK(1) = 3 calls
      assert.strictEqual(mockClient.query.mock.calls.length, 3);
    }
  });
});