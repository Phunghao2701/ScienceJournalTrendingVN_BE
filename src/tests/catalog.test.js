import test from 'node:test';
import assert from 'node:assert';
import { mock } from 'node:test';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import pool from '../config/database.js';

test.after(async () => {
  await pool.end();
});

test.describe('Catalog & Search API Suite', () => {
  const testToken = jwt.sign(
    { user_id: 'b6f50e2d-dc99-43ef-b387-052637738f61', email: 'catalog_tester@gmail.com' },
    process.env.JWT_SECRET || 'test_jwt_secret'
  );

  test.afterEach(() => {
    mock.restoreAll();
  });

  // ==========================================
  // 1. GET /api/v1/catalog/journals
  // ==========================================
  test.describe('GET /api/v1/catalog/journals', () => {
    test('Lấy danh sách journals thành công không tìm kiếm', async () => {
      let queryCallCount = 0;
      mock.method(pool, 'query', async (sql, params) => {
        queryCallCount++;
        if (sql.includes('COUNT(')) {
          return { rows: [{ total: 45 }] };
        } else {
          return {
            rows: [
              {
                journal_id: '123',
                display_name: 'Test Journal A',
                issn: '1234-5678',
                type: 'journal',
                coverage: '1990-2026',
                is_open_access: true,
                is_oa_diamond: false
              }
            ]
          };
        }
      });

      const res = await request(app)
        .get('/api/v1/catalog/journals?page=1&limit=5')
        .set('Authorization', `Bearer ${testToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.message, 'Lấy danh sách journal thành công');
      assert.strictEqual(res.body.data.items.length, 1);
      assert.strictEqual(res.body.data.items[0].display_name, 'Test Journal A');
      assert.strictEqual(res.body.data.pagination.page, 1);
      assert.strictEqual(res.body.data.pagination.limit, 5);
      assert.strictEqual(res.body.data.pagination.total, 45);
    });

    test('Lấy danh sách journals thành công có tìm kiếm (search)', async () => {
      let queryCallCount = 0;
      mock.method(pool, 'query', async (sql, params) => {
        queryCallCount++;
        if (sql.includes('COUNT(')) {
          assert.ok(params.includes('%cancer%'));
          return { rows: [{ total: 2 }] };
        } else {
          assert.ok(params.includes('%cancer%'));
          return {
            rows: [
              {
                journal_id: '12',
                display_name: 'CA-A Cancer Journal',
                issn: '1111-2222',
                type: 'journal',
                coverage: '1950-2025',
                is_open_access: true,
                is_oa_diamond: true
              }
            ]
          };
        }
      });

      const res = await request(app)
        .get('/api/v1/catalog/journals?search=cancer&page=2&limit=10')
        .set('Authorization', `Bearer ${testToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.items.length, 1);
      assert.strictEqual(res.body.data.items[0].display_name, 'CA-A Cancer Journal');
      assert.strictEqual(res.body.data.pagination.page, 2);
      assert.strictEqual(res.body.data.pagination.limit, 10);
      assert.strictEqual(res.body.data.pagination.total, 2);
    });

    test('Lỗi 400 - page hoặc limit không phải số nguyên dương', async () => {
      const resPage = await request(app)
        .get('/api/v1/catalog/journals?page=-1')
        .set('Authorization', `Bearer ${testToken}`);
      assert.strictEqual(resPage.status, 400);
      assert.strictEqual(resPage.body.success, false);
      assert.strictEqual(resPage.body.message, 'Tham số page phải là số nguyên dương lớn hơn 0');

      const resLimit = await request(app)
        .get('/api/v1/catalog/journals?limit=abc')
        .set('Authorization', `Bearer ${testToken}`);
      assert.strictEqual(resLimit.status, 400);
      assert.strictEqual(resLimit.body.success, false);
      assert.strictEqual(resLimit.body.message, 'Tham số limit phải là số nguyên dương lớn hơn 0');
    });

    test('Lỗi 401 - Thiếu token', async () => {
      const res = await request(app).get('/api/v1/catalog/journals');
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
    });
  });

  // ==========================================
  // 2. GET /api/v1/catalog/subject-areas
  // ==========================================
  test.describe('GET /api/v1/catalog/subject-areas', () => {
    test('Lấy danh sách subject areas thành công', async () => {
      mock.method(pool, 'query', async () => {
        return {
          rows: [
            { subject_area_id: '1', display_name: 'Medicine', description: 'Medical science' },
            { subject_area_id: '2', display_name: 'Social Sciences', description: 'Social science' }
          ]
        };
      });

      const res = await request(app)
        .get('/api/v1/catalog/subject-areas')
        .set('Authorization', `Bearer ${testToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.message, 'Lấy danh sách subject area thành công');
      assert.strictEqual(res.body.data.length, 2);
      assert.strictEqual(res.body.data[0].display_name, 'Medicine');
    });

    test('Lỗi 401 - Thiếu token', async () => {
      const res = await request(app).get('/api/v1/catalog/subject-areas');
      assert.strictEqual(res.status, 401);
    });
  });

  // ==========================================
  // 3. GET /api/v1/catalog/subject-categories
  // ==========================================
  test.describe('GET /api/v1/catalog/subject-categories', () => {
    test('Lấy danh sách subject categories thành công không lọc', async () => {
      mock.method(pool, 'query', async (sql, params) => {
        assert.strictEqual(params.length, 0);
        return {
          rows: [
            { subject_category_id: '10', subject_area_id: '1', display_name: 'Oncology' }
          ]
        };
      });

      const res = await request(app)
        .get('/api/v1/catalog/subject-categories')
        .set('Authorization', `Bearer ${testToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.length, 1);
      assert.strictEqual(res.body.data[0].display_name, 'Oncology');
    });

    test('Lấy danh sách subject categories lọc theo subject_area_id thành công', async () => {
      mock.method(pool, 'query', async (sql, params) => {
        assert.deepStrictEqual(params, ['1']);
        assert.ok(sql.includes('WHERE subject_area_id = $1'));
        return {
          rows: [
            { subject_category_id: '10', subject_area_id: '1', display_name: 'Oncology' }
          ]
        };
      });

      const res = await request(app)
        .get('/api/v1/catalog/subject-categories?subject_area_id=1')
        .set('Authorization', `Bearer ${testToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.length, 1);
    });
  });

  // ==========================================
  // 4. GET /api/v1/catalog/journals/:id/rankings
  // ==========================================
  test.describe('GET /api/v1/catalog/journals/:id/rankings', () => {
    test('Lấy lịch sử ranking của journal thành công với các loại metric khác nhau', async () => {
      let queryCallCount = 0;
      mock.method(pool, 'query', async (sql, params) => {
        queryCallCount++;
        if (queryCallCount === 1) {
          // Check journal check query
          assert.deepStrictEqual(params, ['15']);
          return { rows: [{ '1': 1 }] };
        } else {
          // Check query filters
          assert.ok(sql.includes('jr.journal_id = $1'));
          assert.ok(sql.includes('AND jr.year = $2'));
          assert.ok(sql.includes('AND UPPER(rm.code) = UPPER($3)'));
          assert.ok(sql.includes('AND UPPER(jr.value_txt) = UPPER($4) AND rm.metric_type = \'QUARTILE\''));
          assert.ok(sql.includes('AND UPPER(jr.source::text) = UPPER($5)'));
          return {
            rows: [
              {
                journal_ranking_id: '3',
                journal_id: '15',
                year: 2025,
                source: 'SCIMAGO',
                metric_code: 'SJR',
                metric_name: 'SJR Score',
                metric_type: 'SCORE',
                value_txt: null,
                value_float: 5.4,
                value_int: null,
                subject_category_id: '101',
                category_display_name: 'Oncology'
              },
              {
                journal_ranking_id: '4',
                journal_id: '15',
                year: 2025,
                source: 'SCIMAGO',
                metric_code: 'SJR_BEST_QUARTILE',
                metric_name: 'SJR Best Quartile',
                metric_type: 'QUARTILE',
                value_txt: 'Q1',
                value_float: null,
                value_int: null,
                subject_category_id: null,
                category_display_name: null
              },
              {
                journal_ranking_id: '5',
                journal_id: '15',
                year: 2025,
                source: 'SCIMAGO',
                metric_code: 'H_INDEX',
                metric_name: 'H Index',
                metric_type: 'INTEGER',
                value_txt: null,
                value_float: null,
                value_int: 120,
                subject_category_id: null,
                category_display_name: null
              }
            ]
          };
        }
      });

      const res = await request(app)
        .get('/api/v1/catalog/journals/15/rankings?year=2025&metric_code=SJR&quartile=Q1&source=SCIMAGO')
        .set('Authorization', `Bearer ${testToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.message, 'Lấy lịch sử ranking của journal thành công');
      assert.ok(res.body.data['2025']);
      assert.strictEqual(res.body.data['2025'].length, 3);

      // Score type
      assert.strictEqual(res.body.data['2025'][0].metric_code, 'SJR');
      assert.strictEqual(res.body.data['2025'][0].value, 5.4);
      assert.deepStrictEqual(res.body.data['2025'][0].subject_category, {
        subject_category_id: '101',
        display_name: 'Oncology'
      });

      // Quartile type
      assert.strictEqual(res.body.data['2025'][1].metric_code, 'SJR_BEST_QUARTILE');
      assert.strictEqual(res.body.data['2025'][1].value, 'Q1');
      assert.strictEqual(res.body.data['2025'][1].subject_category, null);

      // Integer type
      assert.strictEqual(res.body.data['2025'][2].metric_code, 'H_INDEX');
      assert.strictEqual(res.body.data['2025'][2].value, 120);
    });

    test('Lỗi 404 - Journal không tồn tại', async () => {
      mock.method(pool, 'query', async () => {
        return { rows: [] }; // Journal check returns empty
      });

      const res = await request(app)
        .get('/api/v1/catalog/journals/999/rankings')
        .set('Authorization', `Bearer ${testToken}`);

      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'Tạp chí không tồn tại');
    });
  });

  // ==========================================
  // 5. GET /api/v1/catalog/volumes (Public)
  // ==========================================
  test.describe('GET /api/v1/catalog/volumes (Public)', () => {
    test('Lấy danh sách volumes thành công không lọc (không cần Token)', async () => {
      mock.method(pool, 'query', async (sql, params) => {
        assert.strictEqual(params.length, 0);
        assert.ok(sql.includes('FROM "Volume"'));
        return {
          rows: [
            {
              volume_id: '12',
              journal_id: '11',
              journal_name: 'Test Journal A',
              volume_number: 12,
              publication_year: 2025
            }
          ]
        };
      });

      const res = await request(app).get('/api/v1/catalog/volumes');

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.message, 'Lấy danh sách volume thành công');
      assert.strictEqual(res.body.data.length, 1);
      assert.strictEqual(res.body.data[0].volume_number, 12);
      assert.strictEqual(res.body.data[0].journal_name, 'Test Journal A');
    });

    test('Lấy danh sách volumes lọc theo journal_id thành công', async () => {
      mock.method(pool, 'query', async (sql, params) => {
        assert.deepStrictEqual(params, ['11']);
        assert.ok(sql.includes('WHERE v.journal_id = $1'));
        return {
          rows: [
            {
              volume_id: '12',
              journal_id: '11',
              journal_name: 'Test Journal A',
              volume_number: 12,
              publication_year: 2025
            }
          ]
        };
      });

      const res = await request(app).get('/api/v1/catalog/volumes?journal_id=11');

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.length, 1);
      assert.strictEqual(res.body.data[0].journal_id, '11');
    });

    test('Lỗi 400 - journal_id không hợp lệ', async () => {
      const resVal = await request(app).get('/api/v1/catalog/volumes?journal_id=abc');
      assert.strictEqual(resVal.status, 400);
      assert.strictEqual(resVal.body.success, false);
      assert.strictEqual(resVal.body.message, 'Tham số journal_id phải là số nguyên dương lớn hơn 0');

      const resNeg = await request(app).get('/api/v1/catalog/volumes?journal_id=-5');
      assert.strictEqual(resNeg.status, 400);
      assert.strictEqual(resNeg.body.success, false);
      assert.strictEqual(resNeg.body.message, 'Tham số journal_id phải là số nguyên dương lớn hơn 0');
    });
  });

  // ==========================================
  // 6. GET /api/v1/catalog/issues (Public)
  // ==========================================
  test.describe('GET /api/v1/catalog/issues (Public)', () => {
    test('Lấy danh sách issues thành công không lọc (không cần Token)', async () => {
      mock.method(pool, 'query', async (sql, params) => {
        assert.strictEqual(params.length, 0);
        assert.ok(sql.includes('FROM "Issue"'));
        return {
          rows: [
            {
              issue_id: '15',
              volume_id: '12',
              issue_number: '1',
              publication_year: 2025
            }
          ]
        };
      });

      const res = await request(app).get('/api/v1/catalog/issues');

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.message, 'Lấy danh sách issue thành công');
      assert.strictEqual(res.body.data.length, 1);
      assert.strictEqual(res.body.data[0].issue_number, '1');
    });

    test('Lấy danh sách issues lọc theo volume_id thành công', async () => {
      mock.method(pool, 'query', async (sql, params) => {
        assert.deepStrictEqual(params, ['12']);
        assert.ok(sql.includes('WHERE volume_id = $1'));
        return {
          rows: [
            {
              issue_id: '15',
              volume_id: '12',
              issue_number: '1',
              publication_year: 2025
            }
          ]
        };
      });

      const res = await request(app).get('/api/v1/catalog/issues?volume_id=12');

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.length, 1);
      assert.strictEqual(res.body.data[0].volume_id, '12');
    });

    test('Lỗi 400 - volume_id không hợp lệ', async () => {
      const resVal = await request(app).get('/api/v1/catalog/issues?volume_id=abc');
      assert.strictEqual(resVal.status, 400);
      assert.strictEqual(resVal.body.success, false);
      assert.strictEqual(resVal.body.message, 'Tham số volume_id phải là số nguyên dương lớn hơn 0');

      const resNeg = await request(app).get('/api/v1/catalog/issues?volume_id=-2');
      assert.strictEqual(resNeg.status, 400);
      assert.strictEqual(resNeg.body.success, false);
      assert.strictEqual(resNeg.body.message, 'Tham số volume_id phải là số nguyên dương lớn hơn 0');
    });
  });
});
