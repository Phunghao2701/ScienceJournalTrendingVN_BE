import { journalExist } from '../../journal/services/journal.service.js';
import { publisherExist } from '../../journal/services/publisher.service.js';
import { zoneExist } from '../../system/services/zone.service.js';

export const validateCreateJournal = async (request, reply) => {
  try {
    const { source_id, publisher_id, country, region, display_name, type, is_open_access, is_oa_diamond, coverage, issn } = request.body;

    if (!display_name || typeof display_name !== 'string' || display_name.trim() === '') {
      return reply.status(400).send({ success: false, code: 'INVALID_DISPLAY_NAME', message: 'display_name lÃ  trÆ°á»ng báº¯t buá»™c vÃ  pháº£i lÃ  chuá»—i khÃ´ng trá»‘ng' });
    }

    request.body.type = (!type || typeof type !== 'string' || type.trim() === '') ? 'Journal' : type.trim();
    if (typeof is_open_access !== 'boolean') request.body.is_open_access = false;
    if (typeof is_oa_diamond !== 'boolean') request.body.is_oa_diamond = false;

    const issnRegex = /^\d{4}-\d{3}[\dX]$/;
    if (issn !== undefined && issn !== null && issn !== '') {
      if (typeof issn === 'string') {
        const issnList = issn.split(',').map(item => item.trim());
        const invalidIssns = issnList.filter(item => !issnRegex.test(item));
        if (invalidIssns.length > 0) return reply.status(400).send({ success: false, code: 'INVALID_ISSN_FORMAT', message: `Äá»‹nh dáº¡ng ISSN khÃ´ng há»£p lá»‡: ${invalidIssns.join(', ')}. Äá»‹nh dáº¡ng Ä‘Ãºng pháº£i lÃ  XXXX-XXXX` });
      } else if (Array.isArray(issn)) {
        const invalidIssns = issn.filter(item => typeof item !== 'string' || !issnRegex.test(item.trim()));
        if (invalidIssns.length > 0) return reply.status(400).send({ success: false, code: 'INVALID_ISSN_ARRAY', message: 'Máº£ng chá»©a má»™t hoáº·c nhiá»u mÃ£ ISSN khÃ´ng Ä‘Ãºng Ä‘á»‹nh dáº¡ng (XXXX-XXXX)' });
      } else {
        return reply.status(400).send({ success: false, code: 'INVALID_ISSN_TYPE', message: 'issn pháº£i lÃ  chuá»—i (string) hoáº·c máº£ng (array)' });
      }
    }

    if (publisher_id !== undefined && publisher_id !== null && publisher_id !== '') {
      const publisherExists = await publisherExist(publisher_id);
      if (!publisherExists) return reply.status(400).send({ success: false, code: 'PUBLISHER_NOT_FOUND', message: 'publisher_id khÃ´ng tá»“n táº¡i trong há»‡ thá»‘ng' });
    } else {
      return reply.status(400).send({ success: false, code: 'PUBLISHER_REQUIRED', message: 'publisher_id lÃ  trÆ°á»ng báº¯t buá»™c' });
    }

    if (country !== undefined && country !== null && country !== '') {
      const countryExists = await zoneExist(country);
      if (!countryExists) return reply.status(400).send({ success: false, code: 'COUNTRY_NOT_FOUND', message: 'country khÃ´ng tá»“n táº¡i trong há»‡ thá»‘ng' });
    } else {
      return reply.status(400).send({ success: false, code: 'COUNTRY_REQUIRED', message: 'country lÃ  trÆ°á»ng báº¯t buá»™c' });
    }

    if (region !== undefined && region !== null && region !== '') {
      const regionExists = await zoneExist(region);
      if (!regionExists) return reply.status(400).send({ success: false, code: 'REGION_NOT_FOUND', message: 'region khÃ´ng tá»“n táº¡i trong há»‡ thá»‘ng' });
    } else {
      return reply.status(400).send({ success: false, code: 'REGION_REQUIRED', message: 'region lÃ  trÆ°á»ng báº¯t buá»™c' });
    }
  } catch (error) {
    return reply.status(500).send({ success: false, code: 'SERVER_VALIDATION_ERROR', message: 'Lá»—i há»‡ thá»‘ng trong quÃ¡ trÃ¬nh kiá»ƒm tra dá»¯ liá»‡u' });
  }
};

export const validateUpdateJournal = async (request, reply) => {
  try {
    const { publisher_id, country, region, type, is_open_access, is_oa_diamond, issn } = request.body;

    if (publisher_id !== undefined) {
      const publisherExists = await publisherExist(publisher_id);
      if (!publisherExists) return reply.status(400).send({ success: false, code: 'PUBLISHER_NOT_FOUND', message: 'publisher_id khÃ´ng tá»“n táº¡i trong há»‡ thá»‘ng' });
    }
    if (country !== undefined) {
      const countryExists = await zoneExist(country);
      if (!countryExists) return reply.status(400).send({ success: false, code: 'COUNTRY_NOT_FOUND', message: 'country khÃ´ng tá»“n táº¡i trong há»‡ thá»‘ng' });
    }
    if (region !== undefined) {
      const regionExists = await zoneExist(region);
      if (!regionExists) return reply.status(400).send({ success: false, code: 'REGION_NOT_FOUND', message: 'region khÃ´ng tá»“n táº¡i trong há»‡ thá»‘ng' });
    }

    request.body.type = (!type || typeof type !== 'string' || type.trim() === '') ? 'Journal' : type.trim();
    if (is_open_access !== undefined && typeof is_open_access !== 'boolean') request.body.is_open_access = false;
    if (is_oa_diamond !== undefined && typeof is_oa_diamond !== 'boolean') request.body.is_oa_diamond = false;

    const issnRegex = /^\d{4}-\d{3}[\dX]$/;
    if (issn !== undefined && issn !== null && issn !== '') {
      if (typeof issn === 'string') {
        const issnList = issn.split(',').map(item => item.trim());
        const invalidIssns = issnList.filter(item => !issnRegex.test(item));
        if (invalidIssns.length > 0) return reply.status(400).send({ success: false, code: 'INVALID_ISSN_FORMAT', message: `Äá»‹nh dáº¡ng ISSN khÃ´ng há»£p lá»‡` });
      } else if (Array.isArray(issn)) {
        const invalidIssns = issn.filter(item => typeof item !== 'string' || !issnRegex.test(item.trim()));
        if (invalidIssns.length > 0) return reply.status(400).send({ success: false, code: 'INVALID_ISSN_ARRAY', message: 'Máº£ng chá»©a má»™t hoáº·c nhiá»u mÃ£ ISSN khÃ´ng Ä‘Ãºng Ä‘á»‹nh dáº¡ng (XXXX-XXXX)' });
      } else {
        return reply.status(400).send({ success: false, code: 'INVALID_ISSN_TYPE', message: 'issn pháº£i lÃ  chuá»—i (string) dáº¡ng danh sÃ¡ch phÃ¢n cÃ¡ch báº±ng dáº¥u pháº©y' });
      }
    }
  } catch (error) {
    return reply.status(500).send({ success: false, code: 'SERVER_VALIDATION_ERROR', message: 'Lá»—i há»‡ thá»‘ng trong quÃ¡ trÃ¬nh kiá»ƒm tra dá»¯ liá»‡u' });
  }
};

export const validateJournalId = async (request, reply) => {
  try {
    const id = request.params.id || request.params.journalId;
    const idNumber = Number(id);
    if (!Number.isInteger(idNumber) || idNumber <= 0) return reply.status(400).send({ success: false, code: 'INVALID_JOURNAL_ID', message: 'Id khÃ´ng há»£p lá»‡, pháº£i lÃ  sá»‘ nguyÃªn dÆ°Æ¡ng' });

    if (!(await journalExist(idNumber))) return reply.status(404).send({ success: false, code: 'JOURNAL_NOT_FOUND', message: `KhÃ´ng tÃ¬m tháº¥y journal nÃ o vá»›i id ${idNumber}` });
  } catch (error) {
    return reply.status(400).send({ success: false, code: 'INVALID_JOURNAL_ID', message: 'Id khÃ´ng há»£p lá»‡, pháº£i lÃ  sá»‘ nguyÃªn dÆ°Æ¡ng' });
  }
};
