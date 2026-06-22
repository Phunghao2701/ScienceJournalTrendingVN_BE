import * as searchService from '../services/search.service.js';
import logger from '../utils/logger.js';

export const search = async (req, res) => {
    const { keyword } = req.params;
    const limit = req.query?.limit;
    try{
        const result = await searchService.search(
            keyword,
            Number(req.query.limit) || 20
        );
        return res.status(200).json({
            success: true,
            code: 'SEARCH_SUCCESS',        
            data: result
        });
    }catch(error){
        logger.error(error);
        return res.status(500).json({
            success: false,
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Lỗi hệ thống khi tìm kiếm'
        });
    }
}