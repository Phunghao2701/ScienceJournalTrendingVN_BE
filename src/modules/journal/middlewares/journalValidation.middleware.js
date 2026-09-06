import { journalExist } from '../../journal/services/journal.service.js';
import { publisherExist } from '../../journal/services/publisher.service.js';
import { zoneExist } from '../../system/services/zone.service.js';

export const validateCreateJournal = async (request, reply) => {
  try {
    const { source_id, publisher_id, country, region, display_name, type, is_open_access, is_oa_diamond, coverage, issn } = request.body;

    if (!display_name || typeof display_name !== 'string' || display_name.trim() === '') {
      return reply.status(400).send({ success: false, code: 'INVALID_DISPLAY_NAME', message: 'display_name l�  trường bắt buộc v�  phải l�  chuỗi không trống' });
    }

    request.body.type = (!type || typeof type !== 'string' || type.trim() === '') ? 'Journal' : type.trim();
    if (typeof is_open_access !== 'boolean') request.body.is_open_access = false;
    if (typeof is_oa_diamond !== 'boolean') request.body.is_oa_diamond = false;

    const issnRegex = /^\d{4}-\d{3}[\dX]$/;
    if (issn !== undefined && issn !== null && issn !== '') {
      if (typeof issn === 'string') {
        const issnList = issn.split(',').map(item => item.trim());
        const invalidIssns = issnList.filter(item => !issnRegex.test(item));
        if (invalidIssns.length > 0) return reply.status(400).send({ success: false, code: 'INVALID_ISSN_FORMAT', message: `Định dạng ISSN không hợp lệ: ${invalidIssns.join(', ')}. Định dạng đúng phải l�  XXXX-XXXX` });
      } else if (Array.isArray(issn)) {
        const invalidIssns = issn.filter(item => typeof item !== 'string' || !issnRegex.test(item.trim()));
        if (invalidIssns.length > 0) return reply.status(400).send({ success: false, code: 'INVALID_ISSN_ARRAY', message: 'Mảng chứa một hoặc nhiều mã ISSN không đúng định dạng (XXXX-XXXX)' });
      } else {
        return reply.status(400).send({ success: false, code: 'INVALID_ISSN_TYPE', message: 'issn phải l�  chuỗi (string) hoặc mảng (array)' });
      }
    }

    if (publisher_id !== undefined && publisher_id !== null && publisher_id !== '') {
      const publisherExists = await publisherExist(publisher_id);
      if (!publisherExists) return reply.status(400).send({ success: false, code: 'PUBLISHER_NOT_FOUND', message: 'publisher_id không tồn tại trong hệ thống' });
    } else {
      return reply.status(400).send({ success: false, code: 'PUBLISHER_REQUIRED', message: 'publisher_id l�  trường bắt buộc' });
    }

    if (country !== undefined && country !== null && country !== '') {
      const countryExists = await zoneExist(country);
      if (!countryExists) return reply.status(400).send({ success: false, code: 'COUNTRY_NOT_FOUND', message: 'country không tồn tại trong hệ thống' });
    } else {
      return reply.status(400).send({ success: false, code: 'COUNTRY_REQUIRED', message: 'country l�  trường bắt buộc' });
    }

    if (region !== undefined && region !== null && region !== '') {
      const regionExists = await zoneExist(region);
      if (!regionExists) return reply.status(400).send({ success: false, code: 'REGION_NOT_FOUND', message: 'region không tồn tại trong hệ thống' });
    } else {
      return reply.status(400).send({ success: false, code: 'REGION_REQUIRED', message: 'region l�  trường bắt buộc' });
    }
  } catch (error) {
    return reply.status(500).send({ success: false, code: 'SERVER_VALIDATION_ERROR', message: 'Lỗi hệ thống trong quá trình kiểm tra dữ liệu' });
  }
};

export const validateUpdateJournal = async (request, reply) => {
  try {
    const { publisher_id, country, region, type, is_open_access, is_oa_diamond, issn } = request.body;

    if (publisher_id !== undefined) {
      const publisherExists = await publisherExist(publisher_id);
      if (!publisherExists) return reply.status(400).send({ success: false, code: 'PUBLISHER_NOT_FOUND', message: 'publisher_id không tồn tại trong hệ thống' });
    }
    if (country !== undefined) {
      const countryExists = await zoneExist(country);
      if (!countryExists) return reply.status(400).send({ success: false, code: 'COUNTRY_NOT_FOUND', message: 'country không tồn tại trong hệ thống' });
    }
    if (region !== undefined) {
      const regionExists = await zoneExist(region);
      if (!regionExists) return reply.status(400).send({ success: false, code: 'REGION_NOT_FOUND', message: 'region không tồn tại trong hệ thống' });
    }

    request.body.type = (!type || typeof type !== 'string' || type.trim() === '') ? 'Journal' : type.trim();
    if (is_open_access !== undefined && typeof is_open_access !== 'boolean') request.body.is_open_access = false;
    if (is_oa_diamond !== undefined && typeof is_oa_diamond !== 'boolean') request.body.is_oa_diamond = false;

    const issnRegex = /^\d{4}-\d{3}[\dX]$/;
    if (issn !== undefined && issn !== null && issn !== '') {
      if (typeof issn === 'string') {
        const issnList = issn.split(',').map(item => item.trim());
        const invalidIssns = issnList.filter(item => !issnRegex.test(item));
        if (invalidIssns.length > 0) return reply.status(400).send({ success: false, code: 'INVALID_ISSN_FORMAT', message: `Định dạng ISSN không hợp lệ` });
      } else if (Array.isArray(issn)) {
        const invalidIssns = issn.filter(item => typeof item !== 'string' || !issnRegex.test(item.trim()));
        if (invalidIssns.length > 0) return reply.status(400).send({ success: false, code: 'INVALID_ISSN_ARRAY', message: 'Mảng chứa một hoặc nhiều mã ISSN không đúng định dạng (XXXX-XXXX)' });
      } else {
        return reply.status(400).send({ success: false, code: 'INVALID_ISSN_TYPE', message: 'issn phải l�  chuỗi (string) dạng danh sách phân cách bằng dấu phẩy' });
      }
    }
  } catch (error) {
    return reply.status(500).send({ success: false, code: 'SERVER_VALIDATION_ERROR', message: 'Lỗi hệ thống trong quá trình kiểm tra dữ liệu' });
  }
};

export const validateJournalId = async (request, reply) => {
  try {
    const id = request.params.id || request.params.journalId;
    const idNumber = Number(id);
    if (!Number.isInteger(idNumber) || idNumber <= 0) return reply.status(400).send({ success: false, code: 'INVALID_JOURNAL_ID', message: 'Id không hợp lệ, phải l�  số nguyên dương' });

    if (!(await journalExist(idNumber))) return reply.status(404).send({ success: false, code: 'JOURNAL_NOT_FOUND', message: `Không tìm thấy journal n� o với id ${idNumber}` });
  } catch (error) {
    return reply.status(400).send({ success: false, code: 'INVALID_JOURNAL_ID', message: 'Id không hợp lệ, phải l�  số nguyên dương' });
  }
};
