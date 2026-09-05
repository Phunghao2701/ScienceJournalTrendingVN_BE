import logger from '../../../utils/logger.js';
import * as journalService from '../services/journal.service.js';
import { getJournalsData } from '../../article/services/discoveryLookupCache.service.js';
import { createLog } from '../../system/services/log.service.js';

export const getJournals = async (request, reply) => {
  try {
    const { search, page = 1, limit = 10, sort, subject_area_ids, subject_category_ids, is_open_access, quartiles, ranking_year, is_oa_diamond, country_ids, subject_area_id, publisher_id, sort_by, sort_order } = request.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    if (isNaN(pageNum) || pageNum <= 0) return reply.status(400).send({ success: false, code: "CATALOG_JOURNAL_PAGINATION_INVALID", message: "Tham sá»‘ page pháº£i lÃ  sá»‘ nguyÃªn dÆ°Æ¡ng lá»›n hÆ¡n 0" });
    if (isNaN(limitNum) || limitNum <= 0) return reply.status(400).send({ success: false, code: "CATALOG_JOURNAL_LIMIT_INVALID", message: "Tham sá»‘ limit pháº£i lÃ  sá»‘ nguyÃªn dÆ°Æ¡ng lá»›n hÆ¡n 0" });

    const result = await getJournalsData({ search, page: pageNum, limit: limitNum, sort, subjectAreaIds: subject_area_ids, subjectCategoryIds: subject_category_ids, isOpenAccess: is_open_access, quartiles, rankingYear: ranking_year, isOaDiamond: is_oa_diamond, countryIds: country_ids, subject_area_id, publisher_id, sort_by, sort_order });
    return reply.status(200).send({ success: true, message: "Láº¥y danh sÃ¡ch journal thÃ nh cÃ´ng", data: { items: result.items, pagination: { page: pageNum, limit: limitNum, total: result.total } } });
  } catch (error) {
    logger.error("Lá»—i khi láº¥y danh sÃ¡ch journal trong catalog:", error);
    return reply.status(500).send({ success: false, code: "CATALOG_JOURNAL_LIST_ERROR", message: "Lá»—i há»‡ thá»‘ng khi láº¥y danh sÃ¡ch journal" });
  }
};

export const getJournalsById = async (request, reply) => {
  try {
    const { id } = request.params;
    if (isNaN(id) || id <= 0) return reply.status(400).send({ success: false, code: "CATALOG_JOURNAL_ID_INVALID", message: "Id khÃ´ng há»£p lá»‡" });

    const journal = await journalService.getJournalsById(id);
    if (!journal) return reply.status(404).send({ success: false, code: "CATALOG_JOURNAL_NOT_FOUND", message: "KhÃ´ng tÃ¬m tháº¥y journal" });

    return reply.status(200).send({ success: true, code: "CATALOG_JOURNAL_DETAIL_SUCCESS", message: "Láº¥y thÃ´ng tin journal thÃ nh cÃ´ng", data: journal });
  } catch (error) {
    return reply.status(500).send({ success: false, code: "CATALOG_JOURNAL_DETAIL_ERROR", message: "Lá»—i há»‡ thá»‘ng khi láº¥y thÃ´ng tin journal" });
  }
};

export const createJournal = async (request, reply) => {
  try {
    const dataJournal = request.body;
    const result = await journalService.createJournal(dataJournal);
    createLog({ userId: request.user?.user_id, userRole: request.user?.role, action: 'CREATE', entityTable: 'Journal', entityId: result.journal_id, message: `Táº¡o má»›i Journal: ${result.display_name || 'KhÃ´ng tÃªn'}`, metadata: { ip: request.ip } });
    return reply.status(201).send({ success: true, code: "CREATE_JOURNAL_SUCCESS", message: "Táº¡o Journal thÃ nh cÃ´ng", data: result });
  } catch (error) {
    return reply.status(500).send({ success: false, code: "CREATE_JOURNAL_ERROR", message: "Lá»—i há»‡ thá»‘ng khi táº¡o Journal", detail: error.message });
  }
};

export const updateJournal = async (request, reply) => {
  try {
    const { id } = request.params;
    const dataJournal = request.body;
    const result = await journalService.updateJournal(id, dataJournal);
    if (!result) return reply.status(404).send({ success: false, code: "JOURNAL_NOT_FOUND", message: "Journal khÃ´ng tá»“n táº¡i" });

    createLog({ userId: request.user?.user_id, userRole: request.user?.role, action: 'UPDATE', entityTable: 'Journal', entityId: id, message: `Cáº­p nháº­t Journal cÃ³ ID: ${id}`, metadata: { ip: request.ip } });
    return reply.status(200).send({ success: true, code: "UPDATE_JOURNAL_SUCCESS", message: "Cáº­p nháº­t Journal thÃ nh cÃ´ng" });
  } catch (error) {
    return reply.status(500).send({ success: false, code: "SERVER_VALIDATION_ERROR", message: "Lá»—i há»‡ thá»‘ng khi cáº­p nháº­t Journal" });
  }
};

export const deleteJournal = async (request, reply) => {
  try {
    await journalService.deleteJournal(request.params.id);
    createLog({ userId: request.user?.user_id, userRole: request.user?.role, action: 'DELETE', entityTable: 'Journal', entityId: request.params.id, message: `XÃ³a má»m Journal cÃ³ ID: ${request.params.id}`, metadata: { ip: request.ip } });
    return reply.status(200).send({ success: true, code: "DELETE_JOURNAL_SUCCESS", message: "XÃ³a Journal thÃ nh cÃ´ng" });
  } catch (error) {
    return reply.status(500).send({ success: false, code: "SERVER_VALIDATION_ERROR", message: "Lá»—i há»‡ thá»‘ng khi xÃ³a Journal" });
  }
};

export const restoreJournal = async (request, reply) => {
  try {
    await journalService.restoreJournal(request.params.id);
    return reply.status(200).send({ success: true, code: "RESTORE_JOURNAL_SUCCESS", message: "KhÃ´i phá»¥c Journal thÃ nh cÃ´ng" });
  } catch (error) {
    return reply.status(500).send({ success: false, code: "SERVER_VALIDATION_ERROR", message: "Lá»—i há»‡ thá»‘ng khi khÃ´i phá»¥c Journal" });
  }
};



