import { test, describe, mock, afterEach } from 'node:test';
import assert from 'node:assert';

import pool from '../../../config/database.js';
import { getInstitutions } from '../../../services/institution.service.js';

describe('Institution Service Unit Test Suite', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  test('getInstitutions() trả về danh sách và pagination khi có kết quả', async () => {
    const mockRows = [
      { institution_id: '30', display_name: 'FPT University', country_code: 'VN', type: 'education', created_at: '2026-07-01T09:03:07.691Z' },
    ];

    let callIndex = 0;
    mock.method(pool, 'query', async () => {
      callIndex += 1;
      if (callIndex === 1) return { rows: mockRows };
      return { rows: [{ total: '1' }] };
    });

    const result = await getInstitutions({ page: 1, limit: 50, search: 'fpt' });

    assert.deepStrictEqual(result.data, mockRows);
    assert.deepStrictEqual(result.pagination, { page: 1, limit: 50, total: 1, total_pages: 1 });
  });

  test('getInstitutions() truyền đúng tham số search/limit/offset cho query', async () => {
    const mockQuery = mock.method(pool, 'query', async () => ({ rows: [{ total: '0' }] }));

    await getInstitutions({ page: 2, limit: 20, search: 'fpt' });

    const [dataCallArgs, countCallArgs] = mockQuery.mock.calls.map((call) => call.arguments);
    assert.deepStrictEqual(dataCallArgs[1], ['%fpt%', 20, 20]);
    assert.deepStrictEqual(countCallArgs[1], ['%fpt%']);
  });

  test('getInstitutions() trả về danh sách rỗng khi không có kết quả', async () => {
    let callIndex = 0;
    mock.method(pool, 'query', async () => {
      callIndex += 1;
      if (callIndex === 1) return { rows: [] };
      return { rows: [{ total: '0' }] };
    });

    const result = await getInstitutions({ page: 1, limit: 50, search: 'khong-ton-tai' });

    assert.deepStrictEqual(result.data, []);
    assert.strictEqual(result.pagination.total, 0);
  });
});
