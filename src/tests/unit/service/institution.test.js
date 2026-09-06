import { test, describe, mock, afterEach } from 'node:test';
import assert from 'node:assert';

import prisma from '../../../config/prisma.js';
import {
  getInstitutionById,
  getInstitutions,
} from '../../../modules/author/services/institution.service.js';

describe('Institution Service Unit Test Suite', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  test('getInstitutionById() trả country_code của đúng institution', async () => {
    const institution = {
      institution_id: '63',
      display_name: "Queen's University Belfast",
      country_code: 'GB',
      type: 'education',
    };
    const queryMock = mock.method(prisma, '$queryRawUnsafe', async () => ([institution]));

    const result = await getInstitutionById(63);

    assert.deepStrictEqual(result, institution);
    assert.deepStrictEqual(queryMock.mock.calls[0].arguments[1], 63);
    assert.match(queryMock.mock.calls[0].arguments[0], /country_code/);
  });

  test('getInstitutionById() trả null khi institution không tồn tại', async () => {
    mock.method(prisma, '$queryRawUnsafe', async () => ([]));

    const result = await getInstitutionById(999999);

    assert.strictEqual(result, null);
  });

  test('getInstitutions() trả về danh sách v�  pagination khi có kết quả', async () => {
    const mockRows = [
      { institution_id: '30', display_name: 'FPT University', country_code: 'VN', type: 'education', created_at: '2026-07-01T09:03:07.691Z' },
    ];

    let callIndex = 0;
    mock.method(prisma, '$queryRawUnsafe', async () => {
      callIndex += 1;
      if (callIndex === 1) return mockRows;
      return [{ total: '1' }];
    });

    const result = await getInstitutions({ page: 1, limit: 50, search: 'fpt' });

    assert.deepStrictEqual(result.data, mockRows);
    assert.deepStrictEqual(result.pagination, { page: 1, limit: 50, total: 1, total_pages: 1 });
  });

  test('getInstitutions() truyền đúng tham số search/limit/offset cho query', async () => {
    const mockQuery = mock.method(prisma, '$queryRawUnsafe', async () => ([{ total: '0' }]));

    await getInstitutions({ page: 2, limit: 20, search: 'fpt' });

    const [dataCallArgs, countCallArgs] = mockQuery.mock.calls.map((call) => call.arguments);
    assert.deepStrictEqual(dataCallArgs.slice(1), ['%fpt%', 20, 20]);
    assert.deepStrictEqual(countCallArgs.slice(1), ['%fpt%']);
  });

  test('getInstitutions() trả về danh sách rỗng khi không có kết quả', async () => {
    let callIndex = 0;
    mock.method(prisma, '$queryRawUnsafe', async () => {
      callIndex += 1;
      if (callIndex === 1) return [];
      return [{ total: '0' }];
    });

    const result = await getInstitutions({ page: 1, limit: 50, search: 'khong-ton-tai' });

    assert.deepStrictEqual(result.data, []);
    assert.strictEqual(result.pagination.total, 0);
  });
});
