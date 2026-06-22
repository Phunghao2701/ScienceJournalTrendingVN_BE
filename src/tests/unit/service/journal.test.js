import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

// Đọc từ file dịch vụ và cấu hình hệ thống của bạn
import { getJournalsByProjectId, getRelatedArticles, getCategoriesByProjectId } from '../../../services/project.service.js'; 
import pool from '../../../config/database.js';       
import logger from '../../../utils/logger.js';   

describe('Test Suite cho Journal và Article Services (Chỉ Luồng Thành Công)', () => {
    let originalQuery;
    let originalLoggerError;
    let mockQueryCalls = [];
    let queryResolveValue;

    // Chạy trước mỗi test case: Thực hiện thiết lập Mock hệ thống
    beforeEach(() => {
        // Lưu lại hàm gốc để khôi phục sau khi test xong
        originalQuery = pool.query;
        originalLoggerError = logger.error;

        // Reset bộ đếm và lịch sử gọi hàm qua mỗi case độc lập
        mockQueryCalls = [];
        queryResolveValue = null;

        // Giả lập hành vi pool.query trả về kết quả thành công
        pool.query = async (text, values) => {
            mockQueryCalls.push({ text, values });
            return queryResolveValue || { rows: [] };
        };

        // Giả lập logger.error trống (cho an toàn)
        logger.error = () => {};
    });

    // Chạy sau mỗi test case: Hoàn trả trạng thái nguyên bản để tránh side-effect
    afterEach(() => {
        pool.query = originalQuery;
        logger.error = originalLoggerError;
    });

    /**-----------------------------------------
     * TEST CASE CHO HÀM: getJournalsByProjectId
     * -----------------------------------------*/
    describe('getJournalsByProjectId()', () => {
        test('Thành công: Trả về mảng danh sách các journals khi truyền đúng projectId', async () => {
            // 1. Giả lập dữ liệu mà Database sẽ trả về
            const mockRows = [
                { journal_id: 1, display_name: 'Journal A', source_id: 'S1', is_open_access: true, issn: '1234-5678' },
                { journal_id: 2, display_name: 'Journal B', source_id: 'S2', is_open_access: false, issn: '8765-4321' }
            ];
            queryResolveValue = { rows: mockRows };

            // 2. Chạy hàm với tham số test
            const projectId = 1;
            const result = await getJournalsByProjectId(projectId);

            // 3. Kiểm tra kết quả (Assertions)
            assert.strictEqual(mockQueryCalls.length, 1); 
            assert.match(mockQueryCalls[0].text, /FROM "Project_Journal"/); 
            assert.deepStrictEqual(mockQueryCalls[0].values, [projectId]); 
            assert.deepStrictEqual(result, mockRows); 
        });
    });

    /**-----------------------------------------
     * TEST CASE CHO HÀM: getRelatedArticles
     * -----------------------------------------*/
    describe('getRelatedArticles()', () => {
        const mockJournalIds = [7];
        const mockCategoryIds = [15, 16];

        test('Thành công: Trả về danh sách bài viết liên quan với option limit mặc định (= 5)', async () => {
            const mockArticles = [
                { article_id: 101, title: 'Article 1', abstract: 'Text...', publication_year: 2026, doi: '10.1000/1', journal_id: 1 }
            ];
            queryResolveValue = { rows: mockArticles };

            // Chạy hàm với option trống (để kích hoạt limit = 5 mặc định)
            const result = await getRelatedArticles(mockJournalIds, mockCategoryIds, {});

            assert.strictEqual(mockQueryCalls.length, 1);
            assert.match(mockQueryCalls[0].text, /LIMIT \$3/);
            assert.deepStrictEqual(mockQueryCalls[0].values, [mockJournalIds, mockCategoryIds, 5]); 
            assert.deepStrictEqual(result, mockArticles);
        });

        test('Thành công: Trả về danh sách bài viết với limit tùy chỉnh được truyền vào', async () => {
            queryResolveValue = { rows: [] };

            // Chạy hàm với limit tự truyền là 10
            await getRelatedArticles(mockJournalIds, mockCategoryIds, { limit: 10 });

            assert.strictEqual(mockQueryCalls.length, 1);
            assert.deepStrictEqual(mockQueryCalls[0].values, [mockJournalIds, mockCategoryIds, 10]); 
        });
    });

    /**-----------------------------------------
     * TEST CASE CHO HÀM: getCategoriesByProjectId
     * -----------------------------------------*/
    describe('getCategoriesByProjectId()', () => {
        test('Thành công: Trả về danh sách danh mục của dự án không trùng lặp', async () => {
            try {
                // 1. Giả lập dữ liệu trả về từ DB
                const mockCategories = [
                    { subject_category_id: 10, display_name: 'Computer Science', description: 'CS fields' },
                    { subject_category_id: 11, display_name: 'Mathematics', description: 'Math fields' }
                ];
                queryResolveValue = { rows: mockCategories };

                // 2. Gọi hàm chạy thử
                const projectId = 1;
                const result = await getCategoriesByProjectId(projectId);

                // --- ĐOẠN LOG DEBUG (SẼ IN RA TERMINAL KHI CHẠY) ---
                console.log('=== DEBUG TEST CATEGORY ===');
                console.log('Số lần DB được gọi:', mockQueryCalls.length);
                if (mockQueryCalls.length > 0) {
                    console.log('Câu lệnh SQL nhận được:', mockQueryCalls[0].text);
                    console.log('Tham số SQL nhận được:', mockQueryCalls[0].values);
                }
                console.log('Kết quả hàm trả về thực tế:', result);
                console.log('============================');

                // 3. Kiểm tra kết quả
                assert.strictEqual(mockQueryCalls.length, 1);
                assert.match(mockQueryCalls[0].text, /SELECT DISTINCT/);
                assert.deepStrictEqual(mockQueryCalls[0].values, [projectId]);
                assert.deepStrictEqual(result, mockCategories);

            } catch (testError) {
                console.error('❌ LỖI CHI TIẾT CỦA BÀI TEST:', testError);
                throw testError;
            }
        });
    });
});