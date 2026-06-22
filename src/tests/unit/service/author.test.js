import { test, describe, mock, afterEach } from 'node:test';
import assert from 'node:assert';

import pool from '../../../config/database.js';
import { getAuthorById, getAuthorAreasBreakdownService, getAuthorArticlesService, getAuthorLeaderboardService } from '../../../services/author.service.js';

describe('Author Service Unit Test Suite', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  test('getAuthorById() trả về thông tin tác giả khi tồn tại', async () => {
    const mockAuthor = {
      author_id: '321',
      display_name: 'Jason R. Westin'
    };

    const mockQuery = mock.method(pool, 'query', async () => ({ rows: [mockAuthor] }));

    const result = await getAuthorById(321);

    assert.deepStrictEqual(result, mockAuthor);
    assert.strictEqual(mockQuery.mock.calls.length, 1);
    assert.deepStrictEqual(mockQuery.mock.calls[0].arguments, ['SELECT * FROM "Author" WHERE "author_id" = $1', [321]]);
  });

  test('getAuthorById() trả về undefined khi không tìm thấy tác giả', async () => {
    mock.method(pool, 'query', async () => ({ rows: [] }));

    const result = await getAuthorById(999);

    assert.strictEqual(result, undefined);
  });

  test('getAuthorAreasBreakdownService() trả về danh sách breakdown', async () => {
    const mockRows = [
      {
        subject_category_id: 2,
        category_name: 'Oncology',
        article_count: 1,
        percentage: 100
      }
    ];

    const mockQuery = mock.method(pool, 'query', async () => ({ rows: mockRows }));

    const result = await getAuthorAreasBreakdownService(321);

    assert.deepStrictEqual(result, mockRows);
    assert.strictEqual(mockQuery.mock.calls.length, 1);
    const [sql, values] = mockQuery.mock.calls[0].arguments;
    assert.strictEqual(typeof sql, 'string');
    assert.deepStrictEqual(values, [321]);
    assert.match(sql, /FROM "Author_Article"/);
  });

  test('getAuthorAreasBreakdownService() ném lỗi khi query thất bại', async () => {
    mock.method(pool, 'query', async () => {
      throw new Error('DB failed');
    });

    await assert.rejects(async () => {
      await getAuthorAreasBreakdownService(321);
    }, {
      message: 'DB failed'
    });
  });

  test('getAuthorArticlesService() trả về danh sách bài viết với limit và page (chuỗi)', async () => {
    const mockRows = [
      {
        article_id: 101,
        title: 'Sample Article',
        abstract: 'Abstract',
        publication_year: 2024,
        doi: '10.1234/example',
        primary_topic: 'Test',
        created_at: '2024-01-01T00:00:00.000Z'
      }
    ];

    const mockQuery = mock.method(pool, 'query', async () => ({ rows: mockRows }));

    const result = await getAuthorArticlesService(321, '5', '2');

    assert.deepStrictEqual(result, mockRows);
    assert.strictEqual(mockQuery.mock.calls.length, 1);
    const [sql, values] = mockQuery.mock.calls[0].arguments;
    assert.strictEqual(values[0], 321);
    assert.strictEqual(values[1], 5); // limit parsed
    assert.strictEqual(values[2], 5); // offset = (2-1)*5
    assert.match(sql, /FROM "Article"/);
  });

  test('getAuthorArticlesService() dùng giá trị mặc định khi không truyền limit/page', async () => {
    const mockRows = [];
    const mockQuery = mock.method(pool, 'query', async () => ({ rows: mockRows }));

    const result = await getAuthorArticlesService(321);

    assert.deepStrictEqual(result, mockRows);
    assert.strictEqual(mockQuery.mock.calls.length, 1);
    const [sql, values] = mockQuery.mock.calls[0].arguments;
    assert.strictEqual(values[0], 321);
    assert.strictEqual(values[1], 10); // default limit
    assert.strictEqual(values[2], 0); // default offset
  });

  test('getAuthorArticlesService() ném lỗi khi query thất bại', async () => {
    mock.method(pool, 'query', async () => {
      throw new Error('DB failed');
    });

    await assert.rejects(async () => {
      await getAuthorArticlesService(321, 10, 1);
    }, {
      message: 'DB failed'
    });
  });

  test('getAuthorLeaderboardService() trả về danh sách xếp hạng với phân trang', async () => {
    const mockRows = [
      {
        author_id: 321,
        orcid: 'https://orcid.org/0000-0002-1824-2337',
        display_name: 'Jason R. Westin',
        url_image: null,
        works_count: 655,
        cited_by_count: 29763,
        h_index: 57,
        i10_index: 195,
        final_rank: 1
      }
    ];

    const mockQuery = mock.method(pool, 'query', async () => ({ rows: mockRows }));

    const result = await getAuthorLeaderboardService('5', '2');

    assert.deepStrictEqual(result, mockRows);
    assert.strictEqual(mockQuery.mock.calls.length, 1);
    const [sql, values] = mockQuery.mock.calls[0].arguments;
    assert.strictEqual(values[0], 5);
    assert.strictEqual(values[1], 5); // offset = (2-1)*5
    assert.match(sql, /FROM "Author"/);
  });

  test('getAuthorLeaderboardService() ném lỗi khi query thất bại', async () => {
    mock.method(pool, 'query', async () => {
      throw new Error('DB failed');
    });

    await assert.rejects(async () => {
      await getAuthorLeaderboardService(10, 1);
    }, {
      message: 'DB failed'
    });
  });
});
