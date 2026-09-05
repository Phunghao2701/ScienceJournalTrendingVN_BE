import * as userService from '../services/user.service.js';
import * as adminService from '../services/admin.service.js';
import * as journalService from '../../journal/services/journal.service.js';
import * as logService from '../../system/services/log.service.js';
import logger from '../../../utils/logger.js';
import { createLog } from '../../system/services/log.service.js';
import { isValidEmail, isValidUUID, isValidDate, isValidRole, isValidStatus, isValidType } from '../../../utils/validation.js';

// --- USER ACTIONS ---

export const deleteMe = async (request, reply) => {
  try {
    const userId = request.user.user_id;
    const deletedUser = await userService.deleteUserById(userId);

    logger.info(`[User]: XÃ³a tÃ i khoáº£n thÃ nh cÃ´ng cho email: ${deletedUser.email} (ID: ${userId})`);

    createLog({
      userId: userId,
      userRole: request.user.role,
      action: 'DELETE',
      entityTable: 'user',
      entityId: userId,
      message: `NgÆ°á»i dÃ¹ng ${deletedUser.email} tá»± xÃ³a tÃ i khoáº£n cá»§a mÃ¬nh.`,
      metadata: { ip: request.ip }
    });

    return reply.status(200).send({
      success: true,
      message: `XÃ³a tÃ i khoáº£n ${deletedUser.email} thÃ nh cÃ´ng!`,
      data: { user_id: deletedUser.user_id },
    });
  } catch (error) {
    if (!error.statusCode || error.statusCode === 500) {
      logger.error("Lá»—i há»‡ thá»‘ng khi tá»± xÃ³a tÃ i khoáº£n:", error);
    }
    return reply.status(error.statusCode || 500).send({
      success: false,
      code: "SERVER_ERROR",
      message: error.statusCode ? error.message : "CÃ³ lá»—i xáº£y ra á»Ÿ Server!",
    });
  }
};

export const updateMe = async (request, reply) => {
  try {
    const userId = request.user.user_id;
    const { first_name, last_name, date_of_birth, gender, url_image } = request.body;

    const updatedUser = await userService.updateUserProfile(userId, {
      first_name, last_name, date_of_birth, gender, url_image,
    });

    logger.info(`[User]: Cáº­p nháº­t thÃ´ng tin tÃ i khoáº£n thÃ nh cÃ´ng cho email: ${updatedUser.email} (ID: ${userId})`);

    createLog({
      userId: userId,
      userRole: request.user.role,
      action: 'UPDATE',
      entityTable: 'user',
      entityId: userId,
      message: `NgÆ°á»i dÃ¹ng ${updatedUser.email} Ä‘Ã£ tá»± cáº­p nháº­t thÃ´ng tin cÃ¡ nhÃ¢n.`,
      metadata: { ip: request.ip }
    });

    return reply.status(200).send({
      success: true,
      code: "UPDATE_PROFILE_SUCCESS",
      message: "Cáº­p nháº­t thÃ´ng tin cÃ¡ nhÃ¢n thÃ nh cÃ´ng!",
      data: updatedUser,
    });
  } catch (error) {
    if (!error.statusCode || error.statusCode === 500) {
      logger.error("Lá»—i há»‡ thá»‘ng khi cáº­p nháº­t thÃ´ng tin cÃ¡ nhÃ¢n:", error);
    }
    return reply.status(error.statusCode || 500).send({
      success: false,
      code: "SERVER_ERROR",
      message: error.statusCode ? error.message : "CÃ³ lá»—i xáº£y ra á»Ÿ Server!",
    });
  }
};

export const getMe = async (request, reply) => {
  try {
    const userId = request.user.user_id;
    const user = await userService.getUserById(userId);

    return reply.status(200).send({
      success: true,
      code: "SUCCESS_GET_USER",
      message: "Láº¥y thÃ´ng tin ngÆ°á»i dÃ¹ng thÃ nh cÃ´ng!",
      data: user,
    });
  } catch (error) {
    return reply.status(error.statusCode || 500).send({
      success: false,
      code: "SERVER_ERROR",
      message: error.statusCode ? error.message : "CÃ³ lá»—i xáº£y ra á»Ÿ Server!",
    });
  }
};

export const updateUserById = async (request, reply) => {
  try {
    const { id } = request.params;
    const userId = request.user.user_id;

    if (!isValidUUID(id)) {
      return reply.status(400).send({ success: false, code: "INVALID_USER_ID", message: "ID ngÆ°á»i dÃ¹ng khÃ´ng há»£p lá»‡" });
    }
    if (userId !== id) {
      return reply.status(403).send({ success: false, code: "FORBIDDEN", message: "Báº¡n chá»‰ Ä‘Æ°á»£c phÃ©p cáº­p nháº­t há»“ sÆ¡ cá»§a chÃ­nh mÃ¬nh" });
    }

    const body = request.body;
    if (!body || Object.keys(body).length === 0) {
      return reply.status(400).send({ success: false, code: "EMPTY_BODY", message: "Dá»¯ liá»‡u cáº­p nháº­t khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng" });
    }

    const allowedFields = ['first_name', 'last_name', 'url_image', 'date_of_birth', 'gender'];
    const updateData = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }
    if (Object.keys(updateData).length === 0) {
      return reply.status(400).send({ success: false, code: "INVALID_FIELDS", message: "KhÃ´ng cÃ³ trÆ°á»ng há»£p lá»‡ nÃ o Ä‘á»ƒ cáº­p nháº­t" });
    }

    if (updateData.date_of_birth && !isValidDate(updateData.date_of_birth)) {
      return reply.status(400).send({ success: false, code: "INVALID_DATE", message: "NgÃ y sinh khÃ´ng há»£p lá»‡" });
    }
    if (updateData.gender !== undefined && typeof updateData.gender !== 'boolean') {
      return reply.status(400).send({ success: false, code: "INVALID_GENDER", message: "Giá»›i tÃ­nh pháº£i lÃ  kiá»ƒu boolean" });
    }

    const updatedUser = await userService.updateUserProfile(id, updateData);

    createLog({
      userId: id,
      userRole: request.user.role,
      action: 'UPDATE',
      entityTable: 'user',
      entityId: id,
      message: `NgÆ°á»i dÃ¹ng ${updatedUser.email} Ä‘Ã£ tá»± cáº­p nháº­t thÃ´ng tin cÃ¡ nhÃ¢n.`,
      metadata: { ip: request.ip }
    });

    return reply.status(200).send({
      success: true,
      code: "UPDATE_PROFILE_SUCCESS",
      message: "Cáº­p nháº­t thÃ´ng tin cÃ¡ nhÃ¢n thÃ nh cÃ´ng",
      data: updatedUser,
    });
  } catch (error) {
    logger.error("Lá»—i tá»± cáº­p nháº­t profile qua ID:", error);
    return reply.status(500).send({ success: false, code: "SERVER_ERROR", message: "Lá»—i há»‡ thá»‘ng khi cáº­p nháº­t há»“ sÆ¡" });
  }
};

// --- ADMIN ACTIONS (USERS) ---

export const adminUpdateUser = async (request, reply) => {
  try {
    const { id } = request.params;
    if (!isValidUUID(id)) return reply.status(400).send({ success: false, code: "INVALID_USER_ID", message: "ID ngÆ°á»i dÃ¹ng khÃ´ng há»£p lá»‡" });

    const body = request.body;
    if (!body || Object.keys(body).length === 0) return reply.status(400).send({ success: false, code: "EMPTY_BODY", message: "Dá»¯ liá»‡u cáº­p nháº­t khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng" });

    const allowedFields = ['status', 'role', 'type', 'first_name', 'last_name', 'url_image', 'date_of_birth', 'gender', 'email', 'password'];
    const updateData = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }
    if (Object.keys(updateData).length === 0) return reply.status(400).send({ success: false, code: "INVALID_FIELDS", message: "KhÃ´ng cÃ³ trÆ°á»ng há»£p lá»‡ nÃ o Ä‘á»ƒ cáº­p nháº­t" });

    if (updateData.status && !isValidStatus(updateData.status)) return reply.status(400).send({ success: false, code: "INVALID_STATUS", message: "Tráº¡ng thÃ¡i khÃ´ng há»£p lá»‡" });
    if (updateData.role && !isValidRole(updateData.role)) return reply.status(400).send({ success: false, code: "INVALID_ROLE", message: "Quyá»n khÃ´ng há»£p lá»‡" });
    if (updateData.type && !isValidType(updateData.type)) return reply.status(400).send({ success: false, code: "INVALID_TYPE", message: "PhÆ°Æ¡ng thá»©c Ä‘Äƒng nháº­p khÃ´ng há»£p lá»‡" });
    if (updateData.date_of_birth && !isValidDate(updateData.date_of_birth)) return reply.status(400).send({ success: false, code: "INVALID_DATE", message: "NgÃ y sinh khÃ´ng há»£p lá»‡" });
    if (updateData.gender !== undefined && typeof updateData.gender !== 'boolean') return reply.status(400).send({ success: false, code: "INVALID_GENDER", message: "Giá»›i tÃ­nh pháº£i lÃ  kiá»ƒu boolean" });
    if (updateData.email && !isValidEmail(updateData.email)) return reply.status(400).send({ success: false, code: "INVALID_EMAIL", message: "Email khÃ´ng Ä‘Ãºng Ä‘á»‹nh dáº¡ng" });
    if (updateData.password && updateData.password.length < 6) return reply.status(400).send({ success: false, code: "INVALID_PASSWORD", message: "Máº­t kháº©u pháº£i cÃ³ Ã­t nháº¥t 6 kÃ½ tá»±" });

    const updatedUser = await adminService.updateUserByAdmin(id, updateData);
    if (!updatedUser) return reply.status(404).send({ success: false, code: "USER_NOT_FOUND", message: "NgÆ°á»i dÃ¹ng khÃ´ng tá»“n táº¡i" });

    createLog({
      userId: request.user?.user_id,
      userRole: request.user?.role,
      action: 'UPDATE',
      source: 'ADMIN_PANEL',
      entityTable: 'user',
      entityId: id,
      message: `Admin Ä‘Ã£ cáº­p nháº­t thÃ´ng tin ngÆ°á»i dÃ¹ng: ${updatedUser.email}`,
      metadata: { ip: request.ip, updatedFields: Object.keys(updateData).filter(k => k !== 'password') }
    });

    return reply.status(200).send({
      success: true,
      code: "ADMIN_UPDATE_USER_SUCCESS",
      message: "Admin cáº­p nháº­t thÃ´ng tin ngÆ°á»i dÃ¹ng thÃ nh cÃ´ng",
      data: updatedUser
    });
  } catch (error) {
    logger.error("Lá»—i admin cáº­p nháº­t user:", error);
    if (error.code === '23505') {
      return reply.status(400).send({ success: false, code: "EMAIL_EXISTS", message: "Email Ä‘Ã£ Ä‘Æ°á»£c sá»­ dá»¥ng bá»Ÿi ngÆ°á»i dÃ¹ng khÃ¡c" });
    }
    return reply.status(500).send({ success: false, code: "INTERNAL_SERVER_ERROR", message: "Lá»—i há»‡ thá»‘ng" });
  }
};

export const getUsers = async (request, reply) => {
  try {
    const options = {
      search: request.query.search,
      role: request.query.role,
      status: request.query.status,
      page: parseInt(request.query.page, 10) || 1,
      limit: parseInt(request.query.limit, 10) || 10,
      sortBy: request.query.sortBy,
      sortOrder: request.query.sortOrder
    };

    const result = await adminService.getUsersList(options);

    return reply.status(200).send({
      success: true,
      code: "GET_USERS_SUCCESS",
      message: "Láº¥y danh sÃ¡ch ngÆ°á»i dÃ¹ng thÃ nh cÃ´ng",
      data: result.items,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error("Lá»—i khi láº¥y danh sÃ¡ch ngÆ°á»i dÃ¹ng (User Controller):", error);
    return reply.status(500).send({ success: false, code: "INTERNAL_SERVER_ERROR", message: "Lá»—i há»‡ thá»‘ng khi láº¥y danh sÃ¡ch ngÆ°á»i dÃ¹ng" });
  }
};

export const getUserDetail = async (request, reply) => {
  try {
    const { id } = request.params;
    if (!isValidUUID(id)) return reply.status(400).send({ success: false, code: "INVALID_USER_ID", message: "ID ngÆ°á»i dÃ¹ng khÃ´ng há»£p lá»‡ (pháº£i lÃ  Ä‘á»‹nh dáº¡ng UUID)" });

    const user = await adminService.getUserDetailById(id);
    if (!user) return reply.status(404).send({ success: false, code: "USER_NOT_FOUND", message: "KhÃ´ng tÃ¬m tháº¥y ngÆ°á»i dÃ¹ng" });

    createLog({
      userId: request.user?.user_id,
      userRole: request.user?.role,
      action: 'VIEW',
      source: 'ADMIN_PANEL',
      entityTable: 'user',
      entityId: id,
      message: `Admin Ä‘Ã£ xem chi tiáº¿t ngÆ°á»i dÃ¹ng: ${user.email}`,
      metadata: { ip: request.ip }
    });

    return reply.status(200).send({ success: true, code: "GET_USER_DETAIL_SUCCESS", message: "Láº¥y chi tiáº¿t ngÆ°á»i dÃ¹ng thÃ nh cÃ´ng", data: user });
  } catch (error) {
    logger.error("Lá»—i khi láº¥y chi tiáº¿t ngÆ°á»i dÃ¹ng (User Controller):", error);
    return reply.status(500).send({ success: false, code: "INTERNAL_SERVER_ERROR", message: "Lá»—i há»‡ thá»‘ng khi láº¥y chi tiáº¿t ngÆ°á»i dÃ¹ng" });
  }
};

export const createUser = async (request, reply) => {
  try {
    const { email, password, first_name, last_name, role, status, date_of_birth, gender } = request.body;

    if (!email || !email.trim()) return reply.status(400).send({ success: false, code: "EMAIL_REQUIRED", message: "Email khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng" });
    if (!isValidEmail(email)) return reply.status(400).send({ success: false, code: "EMAIL_INVALID", message: "Email khÃ´ng Ä‘Ãºng Ä‘á»‹nh dáº¡ng" });
    if (!password || password.length < 6) return reply.status(400).send({ success: false, code: "PASSWORD_INVALID", message: "Máº­t kháº©u pháº£i cÃ³ Ã­t nháº¥t 6 kÃ½ tá»±" });

    const newUser = await adminService.createUser({ email, password, first_name, last_name, role, status, date_of_birth, gender });

    createLog({
      userId: request.user?.user_id,
      userRole: request.user?.role,
      action: 'CREATE',
      source: 'ADMIN_PANEL',
      entityTable: 'user',
      entityId: newUser.user_id,
      message: `Admin Ä‘Ã£ táº¡o tÃ i khoáº£n má»›i: ${newUser.email} (Role: ${newUser.role})`,
      metadata: { ip: request.ip }
    });

    return reply.status(201).send({ success: true, code: "CREATE_USER_SUCCESS", message: "Táº¡o ngÆ°á»i dÃ¹ng thÃ nh cÃ´ng", data: newUser });
  } catch (error) {
    logger.error("Lá»—i khi táº¡o ngÆ°á»i dÃ¹ng (User Controller):", error);
    if (error.statusCode === 409) return reply.status(409).send({ success: false, code: "EMAIL_EXISTS", message: error.message });
    return reply.status(500).send({ success: false, code: "INTERNAL_SERVER_ERROR", message: "Lá»—i há»‡ thá»‘ng khi táº¡o ngÆ°á»i dÃ¹ng" });
  }
};

// --- ADMIN ACTIONS (DASHBOARD) ---

export const getJournalRepositorySummary = async (request, reply) => {
  try {
    const { journalId } = request.params;
    const journalExists = await journalService.journalExist(journalId);
    if (!journalExists) {
      return reply.status(404).send({ success: false, message: `KhÃ´ng tÃ¬m tháº¥y táº¡p chÃ­ vá»›i ID: ${journalId}`, errorCode: 'JOURNAL_NOT_FOUND' });
    }
    const summaryData = await journalService.getJournalRepositorySummary(journalId);
    return reply.status(200).send({ success: true, message: 'Láº¥y dá»¯ liá»‡u tá»•ng quan cá»§a kho lÆ°u trá»¯ thÃ nh cÃ´ng', data: summaryData });
  } catch (error) {
    logger.error('[Admin Controller] Lá»—i khi láº¥y repository summary:', error);
    return reply.status(500).send({ success: false, message: 'Lá»—i há»‡ thá»‘ng khi láº¥y dá»¯ liá»‡u tá»•ng quan', errorCode: 'INTERNAL_ERROR' });
  }
};

export const summary = async (request, reply) => {
  try {
    const data = await adminService.summary();
    return reply.status(200).send({ success: true, code: "GET_SUMMARY_SUCCESS", message: "Láº¥y sá»‘ liá»‡u thá»‘ng kÃª tá»•ng quan thÃ nh cÃ´ng", data });
  } catch (error) {
    logger.error("[Admin Controller] Lá»—i get summary:", error);
    return reply.status(500).send({ success: false, message: "Lá»—i há»‡ thá»‘ng server" });
  }
};

export const publicationTrends = async (request, reply) => {
  try {
    const { year, limit } = request.query;
    const data = await adminService.getPublicationTrends(year, limit);
    return reply.status(200).send({ success: true, code: "GET_PUBLICATION_TRENDS_SUCCESS", message: "Láº¥y dá»¯ liá»‡u biá»ƒu Ä‘á»“ xu hÆ°á»›ng xuáº¥t báº£n thÃ nh cÃ´ng", data });
  } catch (error) {
    logger.error("[Admin Controller] Lá»—i get publication trends:", error);
    return reply.status(500).send({ success: false, message: "Lá»—i há»‡ thá»‘ng server" });
  }
};

export const getVolumeIssueStatus = async (request, reply) => {
  try {
    const page = parseInt(request.query.page) || 1;
    const limit = parseInt(request.query.limit) || 10;
    const result = await adminService.getVolumeIssueStatus({ page, limit });
    return reply.status(200).send({
      success: true, code: "GET_VOLUME_ISSUE_STATUS_SUCCESS", message: "Láº¥y danh sÃ¡ch Volume & Issue Status thÃ nh cÃ´ng",
      data: result.items, pagination: result.pagination,
    });
  } catch (error) {
    logger.error("[Admin Controller] Lá»—i get volume issue status:", error);
    return reply.status(500).send({ success: false, message: "Lá»—i há»‡ thá»‘ng server" });
  }
};

export const exportVolumeIssueStatusCSV = async (request, reply) => {
  try {
    const data = await adminService.exportVolumeIssueStatus();

    if (!data || data.length === 0) {
      reply.header("Content-Type", "text/csv; charset=utf-8");
      reply.header("Content-Disposition", 'attachment; filename="volume_issue_status.csv"');
      return reply.status(200).send("volume_id,volume_number,publication_year,journal_name,total_issues,status,progress\n");
    }

    const header = Object.keys(data[0]).join(",") + "\n";
    const rows = data.map((row) => {
      return Object.values(row).map((val) => {
        if (val === null || val === undefined) return '""';
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(",");
    }).join("\n");

    const csvContent = "\uFEFF" + header + rows;
    reply.header("Content-Type", "text/csv; charset=utf-8");
    reply.header("Content-Disposition", 'attachment; filename="volume_issue_status.csv"');
    return reply.status(200).send(csvContent);
  } catch (error) {
    logger.error("[Admin Controller] Lá»—i export CSV:", error);
    return reply.status(500).send({ success: false, message: "Lá»—i há»‡ thá»‘ng server" });
  }
};

export const getRecentActivities = async (request, reply) => {
  try {
    const page = parseInt(request.query.page) || 1;
    const limit = parseInt(request.query.limit) || 10;
    const result = await logService.getLogs({ page, limit });
    return reply.status(200).send({
      success: true, code: "GET_RECENT_ACTIVITIES_SUCCESS", message: "Láº¥y danh sÃ¡ch hoáº¡t Ä‘á»™ng gáº§n Ä‘Ã¢y thÃ nh cÃ´ng",
      data: result.logs, pagination: result.pagination,
    });
  } catch (error) {
    logger.error("[Admin Controller] Lá»—i get recent activities:", error);
    return reply.status(500).send({ success: false, message: "Lá»—i há»‡ thá»‘ng server" });
  }
};



