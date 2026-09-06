import { getInstitutionsData } from '../../article/services/discoveryLookupCache.service.js';
import * as institutionService from '../services/institution.service.js';

export const getInstitutionById = async (request, reply) => {
  try {
    const institutionId = Number(request.params.id);
    if (!Number.isInteger(institutionId) || institutionId <= 0) return reply.status(400).send({ success: false, message: "Mã cơ sở nghiên cứu không hợp lệ", errorCode: "INVALID_INSTITUTION_ID" });

    const institution = await institutionService.getInstitutionById(institutionId);
    if (!institution) return reply.status(404).send({ success: false, message: "Không tìm thấy cơ sở nghiên cứu", errorCode: "INSTITUTION_NOT_FOUND" });

    return reply.status(200).send({ success: true, message: "Lấy chi tiết cơ sở nghiên cứu th� nh công", data: institution });
  } catch (error) {
    return reply.status(500).send({ success: false, message: "Lỗi hệ thống khi lấy chi tiết cơ sở nghiên cứu", errorCode: "INTERNAL_ERROR", error: error.message });
  }
};

export const getInstitutions = async (request, reply) => {
  try {
    const { page = 1, limit = 50, search = "" } = request.query;
    const result = await getInstitutionsData({ page, limit, search });

    return reply.status(200).send({ success: true, message: "Lấy danh sách cơ sở giáo dục th� nh công", data: result.data, pagination: result.pagination });
  } catch (error) {
    return reply.status(500).send({ success: false, message: "Lỗi hệ thống khi lấy danh sách cơ sở giáo dục", errorCode: "INTERNAL_ERROR", error: error.message });
  }
};
