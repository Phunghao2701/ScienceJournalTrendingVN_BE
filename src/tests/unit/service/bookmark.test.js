import test from 'node:test';
import assert from 'node:assert';
import { mock } from 'node:test';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../../app.js';
import pool from '../../../config/database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'scientific_journal_secret_key';
const userId = 'a8e9c612-40db-4ff0-87a0-0f8b3b4f6cf7';
const testToken = jwt.sign({ user_id: userId, role: 'STUDENT' }, JWT_SECRET);

test.after(async () => {
  await pool.end();
});

test.describe('Bookmark API - CRUD Operations', () => {
  test.afterEach(() => {
    mock.reset();
  });

  test.describe('GET /api/v1/bookmarks', () => {
    test('Lấy danh sách bookmark thành công', async () => {
      mock.method(pool, 'query', async () => ({
        rows: [
          {
            bookmark_id: '1',
            article_id: '5',
            bookmarked_at: '2026-06-01T10:00:00.000Z',
            title: 'A Study on AI',
            abstract: 'Abstract text',
            publication_year: 2026,
            doi: '10.1000/xyz123',
          },
        ],
      }));

      const res = await request(app)
        .get('/api/v1/bookmarks')
        .set('Authorization', `Bearer ${testToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.length, 1);
      assert.strictEqual(res.body.data[0].title, 'A Study on AI');
    });

    test('Lỗi 401 - Chưa xác thực', async () => {
      const res = await request(app).get('/api/v1/bookmarks');

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
    });
  });

  test.describe('POST /api/v1/bookmarks', () => {
    test('Thêm bookmark thành công', async () => {
      let queryCallCount = 0;
      mock.method(pool, 'query', async () => {
        queryCallCount++;
        if (queryCallCount === 1) {
          // articleExists check
          return { rows: [{ exists: true }] };
        }
        // INSERT ... RETURNING
        return {
          rows: [
            {
              bookmark_id: '1',
              user_id: userId,
              article_id: '5',
              bookmarked_at: '2026-06-01T10:00:00.000Z',
            },
          ],
        };
      });

      const res = await request(app)
        .post('/api/v1/bookmarks')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ article_id: 5 });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.article_id, '5');
    });

    test('Lỗi 400 - article_id không hợp lệ', async () => {
      const res = await request(app)
        .post('/api/v1/bookmarks')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ article_id: 'abc' });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, 'INVALID_ARTICLE_ID');
    });

    test('Lỗi 404 - Bài báo không tồn tại', async () => {
      mock.method(pool, 'query', async () => ({ rows: [{ exists: false }] }));

      const res = await request(app)
        .post('/api/v1/bookmarks')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ article_id: 999 });

      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, 'ARTICLE_NOT_FOUND');
    });

    test('Lỗi 401 - Chưa xác thực', async () => {
      const res = await request(app).post('/api/v1/bookmarks').send({ article_id: 5 });

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
    });
  });

  test.describe('DELETE /api/v1/bookmarks/:articleId', () => {
    test('Bỏ bookmark thành công', async () => {
      mock.method(pool, 'query', async () => ({ rows: [{ bookmark_id: '1' }] }));

      const res = await request(app)
        .delete('/api/v1/bookmarks/5')
        .set('Authorization', `Bearer ${testToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.code, 'SUCCESS_REMOVE_BOOKMARK');
    });

    test('Lỗi 404 - Không tìm thấy bookmark', async () => {
      mock.method(pool, 'query', async () => ({ rows: [] }));

      const res = await request(app)
        .delete('/api/v1/bookmarks/999')
        .set('Authorization', `Bearer ${testToken}`);

      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, 'BOOKMARK_NOT_FOUND');
    });

    test('Lỗi 400 - articleId không hợp lệ', async () => {
      const res = await request(app)
        .delete('/api/v1/bookmarks/not-a-number')
        .set('Authorization', `Bearer ${testToken}`);

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, 'INVALID_ARTICLE_ID');
    });
  });
});
