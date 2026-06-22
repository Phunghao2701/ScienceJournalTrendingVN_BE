import { test, describe, mock, afterEach } from 'node:test';
import assert from 'node:assert';

import { getAuthorAreasBreakdown, getAuthorArticles, getAuthorLeaderboard, authorServiceRef } from '../../../controllers/author.controller.js';

describe('Author Controller - getAuthorAreasBreakdown() Unit Test Suite', () => {
  afterEach(() => {
    mock.restoreAll();
  });

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

  test('Thất bại: Trả về 400 nếu authorId không hợp lệ', async () => {
    const req = { params: { id: 'abc' } };
    const res = createMockResponse();

    await getAuthorAreasBreakdown(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.message, 'ID tác giả không hợp lệ');
  });

  test('Thành công: Trả về phân tích lĩnh vực nghiên cứu khi authorId hợp lệ', async () => {
    const mockAuthorInfo = {
      author_id: '321',
      orcid: 'https://orcid.org/0000-0002-1824-2337',
      display_name: 'Jason R. Westin',
      url_image: null,
      openalex_id: 'https://openalex.org/A5021496101',
      works_count: 655,
      cited_by_count: 29763,
      h_index: 57,
      i10_index: 195,
      last_known_institution: 'The University of Texas MD Anderson Cancer Center',
      last_known_institution_id: 'https://openalex.org/I1343551460',
      homepage_url: null,
      openalex_synced_at: '2026-05-27T11:19:56.643Z'
    };
    const mockBreakdown = [
      {
        subject_category_id: '2',
        category_name: 'Oncology',
        article_count: '1',
        percentage: 100
      }
    ];

    const mockGetAuthorById = mock.method(authorServiceRef, 'getAuthorById', async () => mockAuthorInfo);
    const mockGetBreakdown = mock.method(authorServiceRef, 'getAuthorAreasBreakdownService', async () => mockBreakdown);

    const req = { params: { id: '321' } };
    const res = createMockResponse();

    await getAuthorAreasBreakdown(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.message, 'Phân tích lĩnh vực nghiên cứu của tác giả thành công');
    assert.deepStrictEqual(res.body.data.breakdown, mockBreakdown);
    assert.deepStrictEqual(mockGetAuthorById.mock.calls[0].arguments, [321]);
    assert.deepStrictEqual(mockGetBreakdown.mock.calls[0].arguments, [321]);
  });

  test('Thất bại: Trả về 500 khi service ném lỗi', async () => {
    mock.method(authorServiceRef, 'getAuthorById', async () => {
      throw new Error('Database unavailable');
    });

    const req = { params: { id: '321' } };
    const res = createMockResponse();

    await getAuthorAreasBreakdown(req, res);

    assert.strictEqual(res.statusCode, 500);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.message, 'Có lỗi xảy ra ở Server!');
  });

  test('Thành công: Trả về bài viết tác giả với phân trang', async () => {
    const mockArticles = [
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

    const mockGetArticles = mock.method(authorServiceRef, 'getAuthorArticlesService', async () => mockArticles);

    const req = { params: { id: '321' }, query: { limit: '5', page: '2' } };
    const res = createMockResponse();

    await getAuthorArticles(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.pagination.page, 2);
    assert.strictEqual(res.body.pagination.limit, 5);
    assert.deepStrictEqual(res.body.data, mockArticles);
    assert.deepStrictEqual(mockGetArticles.mock.calls[0].arguments, [321, 5, 2]);
  });

  test('Thất bại: Trả về 400 nếu page không hợp lệ khi lấy bài viết tác giả', async () => {
    const req = { params: { id: '321' }, query: { limit: '10', page: '0' } };
    const res = createMockResponse();

    await getAuthorArticles(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.message, 'Giá trị page không hợp lệ');
  });

  test('Thành công: Trả về bảng xếp hạng tác giả', async () => {
    const mockLeaderboard = [
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

    const mockGetLeaderboard = mock.method(authorServiceRef, 'getAuthorLeaderboardService', async () => mockLeaderboard);

    const req = { query: { limit: '10', page: '1' } };
    const res = createMockResponse();

    await getAuthorLeaderboard(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.deepStrictEqual(res.body.data, mockLeaderboard);
    assert.deepStrictEqual(mockGetLeaderboard.mock.calls[0].arguments, [10, 1]);
  });

  test('Thất bại: Trả về 400 nếu limit không hợp lệ khi lấy bảng xếp hạng', async () => {
    const req = { query: { limit: '-5', page: '1' } };
    const res = createMockResponse();

    await getAuthorLeaderboard(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.message, 'Giá trị limit không hợp lệ');
  });
});
