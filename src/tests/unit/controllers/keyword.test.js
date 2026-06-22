import { describe, test, afterEach, after, mock } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import jwt from 'jsonwebtoken';

import app from '../../../app.js';
import pool from '../../../config/database.js';
import {
  getTrendingKeywords,
  getWatchedKeywordArticles,
  deleteWatchedKeyword,
  updateWatchedKeywords,
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
        .send({ keyword_id: 1 });

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
        .send({ keyword_id: 1 });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'ID dự án không hợp lệ');
    });

    test('Lỗi 400 - keyword_id không hợp lệ (số âm, chuỗi)', async () => {
      const res = await request(app)
        .post('/api/v1/projects/1/keywords/watch')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ keyword_id: -5 });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'keyword_id phải là một số nguyên dương');
    });

    test('Lỗi 404 - Project không tồn tại hoặc không phải chủ sở hữu', async () => {
      mock.method(keywordService, 'checkProjectOwnership', async () => false);

      const res = await request(app)
        .post('/api/v1/projects/1/keywords/watch')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ keyword_id: 1 });

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
        .send({ keyword_id: 1 });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'ID từ khóa không tồn tại trong hệ thống');
    });

    test('Lỗi 400 - Tất cả từ khóa đã tồn tại trong danh sách theo dõi', async () => {
      mock.method(keywordService, 'checkProjectOwnership', async () => true);
      mock.method(keywordService, 'validateKeywordIds', async () => true);
      mock.method(keywordService, 'addWatchedKeywords', async () => ({ success: false, existingIds: [1] }));

      const res = await request(app)
        .post('/api/v1/projects/1/keywords/watch')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ keyword_ids: [1, 2] });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, 'ERROR_KEYWORDS_ALREADY_WATCHED');
      assert.strictEqual(res.body.message, 'Có từ khóa đã tồn tại trong danh sách theo dõi của dự án, không thể thêm mới');
    });
  });

  // ==========================================
  // 1.3 Trường hợp thành công
  // ==========================================
  describe('Success Cases', () => {
    test('Thành công (201) - Thêm danh sách keyword hợp lệ', async () => {
      mock.method(keywordService, 'checkProjectOwnership', async () => true);
      mock.method(keywordService, 'validateKeywordIds', async () => true);
      mock.method(keywordService, 'addWatchedKeywords', async () => ({ success: true, insertedCount: 2 }));

      const res = await request(app)
        .post('/api/v1/projects/1/keywords/watch')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ keyword_ids: [1, 2] });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.code, 'SUCCESS_CREATE_WATCHED_KEYWORDS');
      assert.strictEqual(res.body.message, 'Thêm thành công 2 từ khóa vào danh sách theo dõi');
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
        .send({ keyword_id: 1 });

      assert.strictEqual(res.status, 500);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, 'ERROR_SERVER_CREATE_WATCHED_KEYWORD');
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
// 4. deleteWatchedKeyword (Unit Test)
// ============================================================
describe('Keyword Controller - deleteWatchedKeyword()', () => {
  const MOCK_USER_ID = '0028ddd0-d305-4aa1-8baa-2b1a2893c883';

  afterEach(() => {
    mock.restoreAll();
  });

  test('Thất bại: Trả về 404 nếu từ khóa không tồn tại trong danh sách', async () => {
    mock.method(keywordService, 'removeWatchedKeyword', async () => false);

    const req = {
      params: { id: '1', keywordId: '2' },
      user: { user_id: MOCK_USER_ID },
    };
    const res = createMockResponse();

    await deleteWatchedKeyword(req, res);

    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.message, 'Từ khóa không nằm trong danh sách theo dõi của dự án');
  });

  test('Thành công: Trả về 200 khi xóa thành công', async () => {
    mock.method(keywordService, 'removeWatchedKeyword', async () => true);

    const req = {
      params: { id: '1', keywordId: '2' },
      user: { user_id: MOCK_USER_ID },
    };
    const res = createMockResponse();

    await deleteWatchedKeyword(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.message, 'Đã xóa từ khóa khỏi dự án thành công');
  });

  test('Thất bại: Trả về 500 khi có lỗi từ server', async () => {
    mock.method(keywordService, 'removeWatchedKeyword', async () => {
      throw new Error('Database connection lost');
    });

    const req = {
      params: { id: '1', keywordId: '2' },
      user: { user_id: MOCK_USER_ID },
    };
    const res = createMockResponse();

    await deleteWatchedKeyword(req, res);

    assert.strictEqual(res.statusCode, 500);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.message, 'Có lỗi xảy ra ở server khi xóa từ khóa');
  });
});

// ============================================================
// 5. updateWatchedKeywords (Unit Test)
// ============================================================
describe('Keyword Controller - updateWatchedKeywords()', () => {
  const MOCK_USER_ID = '0028ddd0-d305-4aa1-8baa-2b1a2893c883';

  afterEach(() => {
    mock.restoreAll();
  });

  test('Thành công: Trả về 200 khi cập nhật (ghi đè) thành công', async () => {
    mock.method(keywordService, 'replaceWatchedKeywords', async () => true);

    const req = {
      params: { id: '1' },
      body: { keyword_ids: [1, 2, 3] },
      user: { user_id: MOCK_USER_ID },
    };
    const res = createMockResponse();

    await updateWatchedKeywords(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.message, 'Cập nhật danh sách từ khóa theo dõi thành công');
  });

  test('Thất bại: Trả về 500 khi có lỗi từ server', async () => {
    mock.method(keywordService, 'replaceWatchedKeywords', async () => {
      throw new Error('Database connection lost');
    });

    const req = {
      params: { id: '1' },
      body: { keyword_ids: [1, 2, 3] },
      user: { user_id: MOCK_USER_ID },
    };
    const res = createMockResponse();

    await updateWatchedKeywords(req, res);

    assert.strictEqual(res.statusCode, 500);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.message, 'Có lỗi xảy ra ở server khi cập nhật từ khóa');
  });
});