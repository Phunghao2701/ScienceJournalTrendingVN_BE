import * as searchService from '../services/search.service.js';
import logger from '../../../utils/logger.js';

export const search = async (request, reply) => {
    const { keyword } = request.params;
    try{
        const result = await searchService.search(keyword, Number(request.query.limit) || 20);
        return reply.status(200).send({ success: true, code: 'SEARCH_SUCCESS', data: result });
    }catch(error){
        logger.error(error);
        return reply.status(500).send({ success: false, code: 'INTERNAL_SERVER_ERROR', message: 'Lá»—i há»‡ thá»‘ng khi tÃ¬m kiáº¿m' });
    }
};



