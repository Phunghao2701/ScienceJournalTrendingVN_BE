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

test.describe('Comment API - CRUD Operations', () => {
  test.afterEach(() => {
    mock.reset();
  });

  test.describe('GET /api/v1/articles/:id/comments', () => {
    test('Lấy danh sách comment thành công', async () => {
      mock.method(pool, 'query', async () => ({
        rows: [
          {
            comment_id: '1',
            article_id: '5',
            user_id: userId,
            content: 'Bài viết rất hay',
            created_at: '2026-06-01T10:00:00.000Z',
            first_name: 'Nguyen',
            last_name: 'Van A',
            url_image: 'https://example.com/avatar.jpg',
          },
        ],
      }));

      const res = await request(app).get('/api/v1/articles/5/comments');

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.length, 1);
      assert.strictEqual(res.body.data[0].id, '1');
      assert.strictEqual(res.body.data[0].user, 'Nguyen Van A');
      assert.strictEqual(res.body.data[0].avatar, 'https://example.com/avatar.jpg');
      assert.strictEqual(res.body.data[0].content, 'Bài viết rất hay');
    });

    test('Trả về danh sách rỗng khi bài báo chưa có comment nào', async () => {
      let queryCallCount = 0;
      mock.method(pool, 'query', async () => {
        queryCallCount++;
        // Lần gọi đầu tiên đến từ articleExists() trong middleware validateId
        if (queryCallCount === 1) {
          return { rows: [{ exists: true }] };
        }
        return { rows: [] };
      });

      const res = await request(app).get('/api/v1/articles/5/comments');

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.deepStrictEqual(res.body.data, []);
    });
  });

  test.describe('POST /api/v1/articles/:id/comments', () => {
    test('Thêm comment thành công', async () => {
      let queryCallCount = 0;
      mock.method(pool, 'query', async (sql) => {
        queryCallCount++;
        if (sql.includes('INSERT INTO "Comment"')) {
          return {
            rows: [
              {
                comment_id: '10',
                article_id: '5',
                user_id: userId,
                content: 'Comment mới',
                created_at: '2026-06-01T10:00:00.000Z',
              },
            ],
          };
        }
        return {
          rows: [{ first_name: 'Nguyen', last_name: 'Van A', url_image: null }],
        };
      });

      const res = await request(app)
        .post('/api/v1/articles/5/comments')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ content: 'Comment mới' });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.content, 'Comment mới');
      assert.strictEqual(res.body.data.user, 'Nguyen Van A');
    });

    test('Lỗi 400 - Nội dung comment trống', async () => {
      mock.method(pool, 'query', async () => ({ rows: [{ exists: true }] }));

      const res = await request(app)
        .post('/api/v1/articles/5/comments')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ content: '  ' });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, 'CONTENT_REQUIRED');
    });

    test('Lỗi 401 - Chưa xác thực', async () => {
      const res = await request(app)
        .post('/api/v1/articles/5/comments')
        .send({ content: 'Comment mới' });

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
    });
  });

  test.describe('PUT /api/v1/comments/:commentId', () => {
    test('Cập nhật comment thành công', async () => {
      mock.method(pool, 'query', async () => ({
        rows: [
          {
            comment_id: '10',
            article_id: '5',
            user_id: userId,
            content: 'Nội dung đã sửa',
            created_at: '2026-06-01T10:00:00.000Z',
            updated_at: '2026-06-02T10:00:00.000Z',
          },
        ],
      }));

      const res = await request(app)
        .put('/api/v1/comments/10')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ content: 'Nội dung đã sửa' });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.content, 'Nội dung đã sửa');
    });

    test('Lỗi 404 - Comment không tồn tại hoặc không thuộc quyền sở hữu', async () => {
      mock.method(pool, 'query', async () => ({ rows: [] }));

      const res = await request(app)
        .put('/api/v1/comments/999')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ content: 'Nội dung đã sửa' });

      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, 'COMMENT_NOT_FOUND_OR_ACCESS_DENIED');
    });
  });

  test.describe('DELETE /api/v1/comments/:commentId', () => {
    test('Xóa comment thành công', async () => {
      mock.method(pool, 'query', async () => ({ rows: [{ comment_id: '10' }] }));

      const res = await request(app)
        .delete('/api/v1/comments/10')
        .set('Authorization', `Bearer ${testToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.code, 'SUCCESS_DELETE_COMMENT');
    });

    test('Lỗi 404 - Comment không tồn tại hoặc không thuộc quyền sở hữu', async () => {
      mock.method(pool, 'query', async () => ({ rows: [] }));

      const res = await request(app)
        .delete('/api/v1/comments/999')
        .set('Authorization', `Bearer ${testToken}`);

      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.success, false);
    });
  });
});
