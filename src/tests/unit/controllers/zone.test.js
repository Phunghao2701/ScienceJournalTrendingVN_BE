import test from 'node:test';
import assert from 'node:assert';
import { mock } from 'node:test';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../../app.js';
import pool from '../../../config/database.js';

test.after(async () => {
  await pool.end();
});

test.describe('Zone & Geography Trends API', () => {
  const testToken = jwt.sign(
    { user_id: 'a8e9c612-40db-4ff0-87a0-0f8b3b4f6cf7', email: 'tester_zone@gmail.com' },
    process.env.JWT_SECRET || 'scientific_journal_secret_key',
    { expiresIn: '1h' }
  );

  test.afterEach(() => {
    mock.reset();
  });

  // ==========================================
  // 1. GET /api/v1/zones/countries/stats
  // ==========================================
  test.describe('GET /api/v1/zones/countries/stats', () => {
    test('Lấy danh sách thống kê quốc gia thành công', async () => {
      let queryCallCount = 0;
      mock.method(pool, 'query', async (sql, params) => {
        queryCallCount++;
        if (queryCallCount === 1) {
          // Đếm tổng số quốc gia
          return { rows: [{ total: 55 }] };
        } else {
          // Lấy danh sách thống kê
          return {
            rows: [
              {
                zone_id: '3',
                code: 'US',
                name: 'United States',
                iso_code: 'USA',
                article_count: 1500
              },
              {
                zone_id: '89',
                code: 'VN',
                name: 'Viet Nam',
                iso_code: 'VNM',
                article_count: 250
              }
            ]
          };
        }
      });

      const res = await request(app)
        .get('/api/v1/zones/countries/stats?page=1&limit=2')
        .set('Authorization', `Bearer ${testToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.message, 'Lấy danh sách thống kê quốc gia thành công');
      assert.strictEqual(res.body.data.length, 2);
      assert.strictEqual(res.body.data[0].name, 'United States');
      assert.strictEqual(res.body.data[1].name, 'Viet Nam');
      assert.strictEqual(res.body.pagination.total, 55);
      assert.strictEqual(res.body.pagination.page, 1);
      assert.strictEqual(res.body.pagination.limit, 2);
      assert.strictEqual(res.body.pagination.totalPages, 28);
    });

    test('Lỗi 400 - Page không phải số nguyên dương', async () => {
      const res = await request(app)
        .get('/api/v1/zones/countries/stats?page=abc')
        .set('Authorization', `Bearer ${testToken}`);

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'Trang phải là số nguyên dương');
    });

    test('Lỗi 400 - Limit không phải số nguyên dương', async () => {
      const res = await request(app)
        .get('/api/v1/zones/countries/stats?limit=-10')
        .set('Authorization', `Bearer ${testToken}`);

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'Số lượng phần tử mỗi trang phải là số nguyên dương');
    });
  });

  // ==========================================
  // 2. GET /api/v1/zones/regions/stats
  // ==========================================
  test.describe('GET /api/v1/zones/regions/stats', () => {
    test('Lấy danh sách phân vùng toàn cầu thành công (không truyền country_code)', async () => {
      mock.method(pool, 'query', async (sql, params) => {
        return {
          rows: [
            {
              zone_id: '2',
              code: 'WE',
              name: 'Western Europe',
              iso_code: 'WEU',
              article_count: 500
            },
            {
              zone_id: '4',
              code: 'NA',
              name: 'North America',
              iso_code: 'NAR',
              article_count: 450
            }
          ]
        };
      });

      const res = await request(app)
        .get('/api/v1/zones/regions/stats')
        .set('Authorization', `Bearer ${testToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.message, 'Lấy danh sách phân vùng toàn cầu thành công');
      assert.strictEqual(res.body.data.length, 2);
      assert.strictEqual(res.body.data[0].name, 'Western Europe');
    });

    test('Lấy danh sách phân vùng theo country_code thành công', async () => {
      let queryCallCount = 0;
      mock.method(pool, 'query', async (sql, params) => {
        queryCallCount++;
        if (queryCallCount === 1) {
          // Kiểm tra quốc gia tồn tại
          return { rows: [{ zone_id: '3', name: 'United States' }] };
        } else {
          // Trả về vùng của quốc gia
          return {
            rows: [
              {
                zone_id: '10',
                code: 'NA',
                name: 'Northern America',
                iso_code: 'NAM',
                article_count: 350
              }
            ]
          };
        }
      });

      const res = await request(app)
        .get('/api/v1/zones/regions/stats?country_code=US')
        .set('Authorization', `Bearer ${testToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.message, "Lấy danh sách phân vùng của quốc gia 'US' thành công");
      assert.strictEqual(res.body.data.length, 1);
      assert.strictEqual(res.body.data[0].name, 'Northern America');
    });

    test('Lỗi 404 - Quốc gia không tồn tại khi tìm vùng', async () => {
      mock.method(pool, 'query', async (sql, params) => {
        return { rows: [] }; // Quốc gia không tồn tại
      });

      const res = await request(app)
        .get('/api/v1/zones/regions/stats?country_code=INVALID')
        .set('Authorization', `Bearer ${testToken}`);

      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, "Quốc gia có mã 'INVALID' không tồn tại");
    });
  });

  // ==========================================
  // 3. GET /api/v1/zones/countries/:code/regions/stats
  // ==========================================
  test.describe('GET /api/v1/zones/countries/:code/regions/stats', () => {
    test('Lấy phân vùng của quốc gia cụ thể thành công', async () => {
      let queryCallCount = 0;
      mock.method(pool, 'query', async (sql, params) => {
        queryCallCount++;
        if (queryCallCount === 1) {
          return { rows: [{ zone_id: '89', code: 'VN', name: 'Viet Nam', iso_code: 'VNM' }] };
        } else {
          return {
            rows: [
              {
                zone_id: '16',
                code: 'AS',
                name: 'Asiatic Region',
                iso_code: 'ASN',
                article_count: 99
              }
            ]
          };
        }
      });

      const res = await request(app)
        .get('/api/v1/zones/countries/VN/regions/stats')
        .set('Authorization', `Bearer ${testToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.message, 'Lấy thống kê region theo quốc gia thành công');
      assert.strictEqual(res.body.data.country.name, 'Viet Nam');
      assert.strictEqual(res.body.data.country.code, 'VN');
      assert.strictEqual(res.body.data.regions.length, 1);
      assert.strictEqual(res.body.data.regions[0].name, 'Asiatic Region');
    });

    test('Lỗi 404 - Mã quốc gia trên URL không tồn tại', async () => {
      mock.method(pool, 'query', async (sql, params) => {
        return { rows: [] };
      });

      const res = await request(app)
        .get('/api/v1/zones/countries/XYZ/regions/stats')
        .set('Authorization', `Bearer ${testToken}`);

      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, "Quốc gia có mã 'XYZ' không tồn tại");
    });
  });
});
