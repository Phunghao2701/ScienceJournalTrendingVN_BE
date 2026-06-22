import { test, describe, mock, afterEach } from 'node:test';
import assert from 'node:assert';

import { getRelatedArticles, getProjectAnalytics, projectServiceRef } from '../../../controllers/project.controller.js';
import logger from '../../../utils/logger.js';

describe('Project Controller - getRelatedArticles() Unit Test Suite', () => {
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

    test('Thất bại: Trả về 400 nếu projectId không hợp lệ (không phải số nguyên dương)', async () => {
        const req = { params: { id: 'abc' }, query: { limit: '5' } };
        const res = createMockResponse();

        await getRelatedArticles(req, res);

        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(res.body.success, false);
        assert.strictEqual(res.body.message, 'ID dự án không hợp lệ');
    });

    test('Thất bại: Trả về 400 nếu giá trị limit nhỏ hơn hoặc bằng 0', async () => {
        const req = { params: { id: '12' }, query: { limit: '-3' } };
        const res = createMockResponse();

        await getRelatedArticles(req, res);

        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(res.body.success, false);
        assert.strictEqual(res.body.message, 'Giá trị limit không hợp lệ');
    });

    test('Thành công: Tổng hợp bài viết liên quan dựa trên thông tin dự án (Dùng limit mặc định = 5)', async () => {
        const mockJournalIds = [7, 11];
        const mockCategoryIds = [3, 5];
        const mockArticles = [{
            article_id: '125',
            title: 'The evolving tumor microenvironment: From cancer initiation to metastatic outgrowth',
            abstract: null,
            publication_year: 2023,
            doi: 'https://doi.org/10.1016/j.ccell.2023.02.016',
            journal_id: '7'
        }];

        const mockGetJournalIds = mock.method(projectServiceRef, 'getJournalIdsByProjectId', async () => mockJournalIds);
        const mockGetCategoryIds = mock.method(projectServiceRef, 'getCategoryIdsByProjectId', async () => mockCategoryIds);
        const mockGetRelatedArticles = mock.method(projectServiceRef, 'getRelatedArticles', async () => mockArticles);
        mock.method(logger, 'error', () => {});

        const req = { params: { id: '2' }, query: {} };
        const res = createMockResponse();

        await getRelatedArticles(req, res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.body.success, true);
        assert.deepStrictEqual(res.body.data, mockArticles);

        assert.deepStrictEqual(mockGetJournalIds.mock.calls[0].arguments, [2]);
        assert.deepStrictEqual(mockGetCategoryIds.mock.calls[0].arguments, [2]);
        assert.deepStrictEqual(mockGetRelatedArticles.mock.calls[0].arguments, [mockJournalIds, mockCategoryIds, { limit: 5 }]);
    });

    test('Thành công: Tổng hợp bài viết liên quan với giá trị limit tùy chỉnh từ client', async () => {
        const mockJournalIds = [9];
        const mockCategoryIds = [2, 4];
        const mockArticles = [{
            article_id: '139',
            title: 'Targeting Ferroptosis to Iron Out Cancer',
            abstract: null,
            publication_year: 2019,
            doi: 'https://doi.org/10.1016/j.ccell.2019.04.002',
            journal_id: '9'
        }];

        const mockGetJournalIds = mock.method(projectServiceRef, 'getJournalIdsByProjectId', async () => mockJournalIds);
        const mockGetCategoryIds = mock.method(projectServiceRef, 'getCategoryIdsByProjectId', async () => mockCategoryIds);
        const mockGetRelatedArticles = mock.method(projectServiceRef, 'getRelatedArticles', async () => mockArticles);
        mock.method(logger, 'error', () => {});

        const req = { params: { id: '12' }, query: { limit: '10' } };
        const res = createMockResponse();

        await getRelatedArticles(req, res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.body.success, true);
        assert.deepStrictEqual(res.body.data, mockArticles);

        assert.deepStrictEqual(mockGetJournalIds.mock.calls[0].arguments, [12]);
        assert.deepStrictEqual(mockGetCategoryIds.mock.calls[0].arguments, [12]);
        assert.deepStrictEqual(mockGetRelatedArticles.mock.calls[0].arguments, [mockJournalIds, mockCategoryIds, { limit: 10 }]);
    });
});

describe('Project Controller - getProjectAnalytics() Unit Test Suite', () => {
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

    test('Thất bại: Trả về 400 nếu projectId không hợp lệ (không phải số nguyên dương)', async () => {
        const req = { params: { id: 'abc' }, user: { user_id: 'user-1' } };
        const res = createMockResponse();

        await getProjectAnalytics(req, res);

        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(res.body.success, false);
        assert.strictEqual(res.body.message, 'ID dự án không hợp lệ');
    });

    test('Thất bại: Trả về 404 nếu không tìm thấy dự án hoặc không có quyền truy cập', async () => {
        mock.method(projectServiceRef, 'getProjectAnalytics', async () => null);
        mock.method(logger, 'error', () => {});

        const req = { params: { id: '12' }, user: { user_id: 'user-1' } };
        const res = createMockResponse();

        await getProjectAnalytics(req, res);

        assert.strictEqual(res.statusCode, 404);
        assert.strictEqual(res.body.success, false);
        assert.strictEqual(res.body.message, 'Không tìm thấy dự án hoặc bạn không có quyền truy cập dự án này');
    });

    test('Thành công: Trả về dữ liệu phân tích nếu dự án thuộc sở hữu của người dùng', async () => {
        const mockAnalytics = {
            article_volume_trend: [{ year: 2025, article_count: 5 }],
            journal_metrics_comparison: [{ journal_name: 'Nature', journal_id: '1', metric_code: 'SJR', value: 15.2, year: 2025 }]
        };

        const mockGetAnalytics = mock.method(projectServiceRef, 'getProjectAnalytics', async () => mockAnalytics);
        mock.method(logger, 'error', () => {});

        const req = { params: { id: '12' }, user: { user_id: 'user-1' } };
        const res = createMockResponse();

        await getProjectAnalytics(req, res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.body.success, true);
        assert.deepStrictEqual(res.body.data, mockAnalytics);
        assert.deepStrictEqual(mockGetAnalytics.mock.calls[0].arguments, ['12', 'user-1']);
    });
});