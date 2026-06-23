import * as userService from "../services/user.service.js";
import logger from "../utils/logger.js";
import { createLog } from '../services/log.service.js';
import * as adminService from "../services/admin.service.js";
import { isValidEmail, isValidUUID, isValidDate, isValidRole, isValidStatus, isValidType } from '../utils/validation.js';

/**
 * Xử lý yêu cầu tự xóa tài khoản của người dùng
 */
export const deleteMe = async (req, res) => {
  try {
    // req.user được gán từ verifyToken middleware sau khi xác thực JWT thành công
    const userId = req.user.user_id;

    const deletedUser = await userService.deleteUserById(userId);

    logger.info(
      `[User]: Xóa tài khoản thành công cho email: ${deletedUser.email} (ID: ${userId})`,
    );

    createLog({
      userId: userId,
      userRole: req.user.role,
      action: 'DELETE',
      entityTable: 'user',
      entityId: userId,
      message: `Người dùng ${deletedUser.email} tự xóa tài khoản của mình.`,
      metadata: { ip: req.ip }
    });

    return res.status(200).json({
      success: true,
      message: `Xóa tài khoản ${deletedUser.email} thành công!`,
      data: {
        user_id: deletedUser.user_id,
      },
    });
  } catch (error) {
    if (!error.statusCode || error.statusCode === 500) {
      logger.error("Lỗi hệ thống khi tự xóa tài khoản:", error);
    }
    return res.status(error.statusCode || 500).json({
      success: false,
      code: "SERVER_ERROR",
      message: error.statusCode ? error.message : "Có lỗi xảy ra ở Server!",
    });
  }
};

/**
 * API 2: Admin cập nhật thông tin bất kỳ của User (bao gồm Role, Status, Email, Mật khẩu...)
 * 
 * @async
 */
export const adminUpdateUser = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidUUID(id)) {
            return res.status(400).json({ success: false, code: "INVALID_USER_ID", message: "ID người dùng không hợp lệ" });
        }

        const body = req.body;
        if (!body || Object.keys(body).length === 0) {
            return res.status(400).json({ success: false, code: "EMPTY_BODY", message: "Dữ liệu cập nhật không được để trống" });
        }

        // Whitelist các trường Admin được phép cập nhật
        const allowedFields = ['status', 'role', 'type', 'first_name', 'last_name', 'url_image', 'date_of_birth', 'gender', 'email', 'password'];
        const updateData = {};

        for (const field of allowedFields) {
            if (body[field] !== undefined) updateData[field] = body[field];
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ success: false, code: "INVALID_FIELDS", message: "Không có trường hợp lệ nào để cập nhật" });
        }

        // Validations chặt chẽ
        if (updateData.status && !isValidStatus(updateData.status)) return res.status(400).json({ success: false, code: "INVALID_STATUS", message: "Trạng thái không hợp lệ" });
        if (updateData.role && !isValidRole(updateData.role)) return res.status(400).json({ success: false, code: "INVALID_ROLE", message: "Quyền không hợp lệ" });
        if (updateData.type && !isValidType(updateData.type)) return res.status(400).json({ success: false, code: "INVALID_TYPE", message: "Phương thức đăng nhập không hợp lệ" });
        if (updateData.date_of_birth && !isValidDate(updateData.date_of_birth)) return res.status(400).json({ success: false, code: "INVALID_DATE", message: "Ngày sinh không hợp lệ" });
        if (updateData.gender !== undefined && typeof updateData.gender !== 'boolean') return res.status(400).json({ success: false, code: "INVALID_GENDER", message: "Giới tính phải là kiểu boolean" });
        if (updateData.email && !isValidEmail(updateData.email)) return res.status(400).json({ success: false, code: "INVALID_EMAIL", message: "Email không đúng định dạng" });
        if (updateData.password && updateData.password.length < 6) return res.status(400).json({ success: false, code: "INVALID_PASSWORD", message: "Mật khẩu phải có ít nhất 6 ký tự" });

        const updatedUser = await adminService.updateUserByAdmin(id, updateData);

        if (!updatedUser) {
            return res.status(404).json({ success: false, code: "USER_NOT_FOUND", message: "Người dùng không tồn tại" });
        }

        createLog({
            userId: req.user?.user_id,
            userRole: req.user?.role,
            action: 'UPDATE',
            source: 'ADMIN_PANEL',
            entityTable: 'user',
            entityId: id,
            message: `Admin đã cập nhật thông tin người dùng: ${updatedUser.email}`,
            metadata: { ip: req.ip, updatedFields: Object.keys(updateData).filter(k => k !== 'password') }
        });

        return res.status(200).json({
            success: true,
            code: "ADMIN_UPDATE_USER_SUCCESS",
            message: "Admin cập nhật thông tin người dùng thành công",
            data: updatedUser
        });

    } catch (error) {
        logger.error("Lỗi admin cập nhật user:", error);
        if (error.code === '23505') { // 23505 là mã lỗi PostgreSQL cho vi phạm UNIQUE
            return res.status(400).json({ success: false, code: "EMAIL_EXISTS", message: "Email đã được sử dụng bởi người dùng khác" });
        }
        return res.status(500).json({ success: false, code: "INTERNAL_SERVER_ERROR", message: "Lỗi hệ thống" });
    }
};



/**
 * Xử lý cập nhật thông tin cá nhân người dùng
 */
export const updateMe = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { first_name, last_name, date_of_birth, gender, url_image } =
      req.body;

    const updatedUser = await userService.updateUserProfile(userId, {
      first_name,
      last_name,
      date_of_birth,
      gender,
      url_image,
    });

    logger.info(
      `[User]: Cập nhật thông tin tài khoản thành công cho email: ${updatedUser.email} (ID: ${userId})`,
    );

    createLog({
      userId: userId,
      userRole: req.user.role,
      action: 'UPDATE',
      entityTable: 'user',
      entityId: userId,
      message: `Người dùng ${updatedUser.email} đã tự cập nhật thông tin cá nhân.`,
      metadata: { ip: req.ip }
    });

    return res.status(200).json({
      success: true,
      code: "UPDATE_PROFILE_SUCCESS",
      message: "Cập nhật thông tin cá nhân thành công!",
      data: updatedUser,
    });
  } catch (error) {
    if (!error.statusCode || error.statusCode === 500) {
      logger.error("Lỗi hệ thống khi cập nhật thông tin cá nhân:", error);
    }
    return res.status(error.statusCode || 500).json({
      success: false,
      code: "SERVER_ERROR",
      message: error.statusCode ? error.message : "Có lỗi xảy ra ở Server!",
    });
  }
};

export const getMe = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const user = await userService.getUserById(userId);

    return res.status(200).json({
      success: true,
      code: "SUCCESS_GET_USER",
      message: "Lấy thông tin người dùng thành công!",
      data: user,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      code: "SERVER_ERROR",
      message: error.statusCode ? error.message : "Có lỗi xảy ra ở Server!",
    });
  }
}

/**
 * API 1: Người dùng tự cập nhật thông tin hồ sơ của chính mình qua ID.
 * Chặn các trường nhạy cảm như role, status, email, password.
 */
export const updateUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.user_id;

        if (!isValidUUID(id)) {
            return res.status(400).json({
                success: false,
                code: "INVALID_USER_ID",
                message: "ID người dùng không hợp lệ"
            });
        }

        // Kiểm tra quyền (chỉ cập nhật chính mình)
        if (userId !== id) {
            return res.status(403).json({
                success: false,
                code: "FORBIDDEN",
                message: "Bạn chỉ được phép cập nhật hồ sơ của chính mình"
            });
        }

        const body = req.body;
        if (!body || Object.keys(body).length === 0) {
            return res.status(400).json({ success: false, code: "EMPTY_BODY", message: "Dữ liệu cập nhật không được để trống" });
        }

        // Whitelist các field cho phép
        const allowedFields = ['first_name', 'last_name', 'url_image', 'date_of_birth', 'gender'];
        const updateData = {};

        for (const field of allowedFields) {
            if (body[field] !== undefined) updateData[field] = body[field];
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ success: false, code: "INVALID_FIELDS", message: "Không có trường hợp lệ nào để cập nhật" });
        }

        // Validate định dạng
        if (updateData.date_of_birth && !isValidDate(updateData.date_of_birth)) {
            return res.status(400).json({ success: false, code: "INVALID_DATE", message: "Ngày sinh không hợp lệ" });
        }
        if (updateData.gender !== undefined && typeof updateData.gender !== 'boolean') {
            return res.status(400).json({ success: false, code: "INVALID_GENDER", message: "Giới tính phải là kiểu boolean" });
        }

        // Tận dụng service hiện có
        const updatedUser = await userService.updateUserProfile(id, updateData);

        createLog({
            userId: id,
            userRole: req.user.role,
            action: 'UPDATE',
            entityTable: 'user',
            entityId: id,
            message: `Người dùng ${updatedUser.email} đã tự cập nhật thông tin cá nhân.`,
            metadata: { ip: req.ip }
        });

        return res.status(200).json({
            success: true,
            code: "UPDATE_PROFILE_SUCCESS",
            message: "Cập nhật thông tin cá nhân thành công",
            data: updatedUser,
        });
    } catch (error) {
        logger.error("Lỗi tự cập nhật profile qua ID:", error);
        return res.status(500).json({ success: false, code: "SERVER_ERROR", message: "Lỗi hệ thống khi cập nhật hồ sơ" });
    }
};

/**
 * Controller xử lý yêu cầu lấy danh sách người dùng.
 * Yêu cầu quyền ADMINISTRATOR.
 * 
 * @async
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 */
export const getUsers = async (req, res) => {
    try {
        const options = {
            search: req.query.search,
            role: req.query.role,
            status: req.query.status,
            page: parseInt(req.query.page, 10) || 1,
            limit: parseInt(req.query.limit, 10) || 10,
            sortBy: req.query.sortBy,
            sortOrder: req.query.sortOrder
        };

        const result = await adminService.getUsersList(options);

        return res.status(200).json({
            success: true,
            code: "GET_USERS_SUCCESS",
            message: "Lấy danh sách người dùng thành công",
            data: result.items,
            pagination: result.pagination
        });
    } catch (error) {
        logger.error("Lỗi khi lấy danh sách người dùng (User Controller):", error);
        return res.status(500).json({
            success: false,
            code: "INTERNAL_SERVER_ERROR",
            message: "Lỗi hệ thống khi lấy danh sách người dùng"
        });
    }
};

/**
 * Controller lấy thông tin chi tiết của một người dùng.
 * Yêu cầu quyền ADMINISTRATOR.
 * 
 * @async
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 */
export const getUserDetail = async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!isValidUUID(id)) {
            return res.status(400).json({
                success: false,
                code: "INVALID_USER_ID",
                message: "ID người dùng không hợp lệ (phải là định dạng UUID)"
            });
        }

        const user = await adminService.getUserDetailById(id);

        if (!user) {
            return res.status(404).json({
                success: false,
                code: "USER_NOT_FOUND",
                message: "Không tìm thấy người dùng"
            });
        }

        createLog({
            userId: req.user?.user_id,
            userRole: req.user?.role,
            action: 'VIEW',
            source: 'ADMIN_PANEL',
            entityTable: 'user',
            entityId: id,
            message: `Admin đã xem chi tiết người dùng: ${user.email}`,
            metadata: { ip: req.ip }
        });

        return res.status(200).json({
            success: true,
            code: "GET_USER_DETAIL_SUCCESS",
            message: "Lấy chi tiết người dùng thành công",
            data: user
        });
    } catch (error) {
        logger.error("Lỗi khi lấy chi tiết người dùng (User Controller):", error);
        return res.status(500).json({
            success: false,
            code: "INTERNAL_SERVER_ERROR",
            message: "Lỗi hệ thống khi lấy chi tiết người dùng"
        });
    }
};

/**
 * Controller xử lý yêu cầu tạo mới người dùng.
 * Yêu cầu quyền ADMINISTRATOR.
 * 
 * @async
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 */
export const createUser = async (req, res) => {
    try {
        const { email, password, first_name, last_name, role, status, date_of_birth, gender } = req.body;

        if (!email || !email.trim()) {
            return res.status(400).json({ success: false, code: "EMAIL_REQUIRED", message: "Email không được để trống" });
        }
        if (!isValidEmail(email)) {
            return res.status(400).json({ success: false, code: "EMAIL_INVALID", message: "Email không đúng định dạng" });
        }
        if (!password || password.length < 6) {
            return res.status(400).json({ success: false, code: "PASSWORD_INVALID", message: "Mật khẩu phải có ít nhất 6 ký tự" });
        }

        const newUser = await adminService.createUser({
            email, password, first_name, last_name, role, status, date_of_birth, gender
        });

        createLog({
            userId: req.user?.user_id,
            userRole: req.user?.role,
            action: 'CREATE',
            source: 'ADMIN_PANEL',
            entityTable: 'user',
            entityId: newUser.user_id,
            message: `Admin đã tạo tài khoản mới: ${newUser.email} (Role: ${newUser.role})`,
            metadata: { ip: req.ip }
        });

        return res.status(201).json({
            success: true,
            code: "CREATE_USER_SUCCESS",
            message: "Tạo người dùng thành công",
            data: newUser
        });

    } catch (error) {
        logger.error("Lỗi khi tạo người dùng (User Controller):", error);
        
        if (error.statusCode === 409) {
            return res.status(409).json({ success: false, code: "EMAIL_EXISTS", message: error.message });
        }

        return res.status(500).json({
            success: false,
            code: "INTERNAL_SERVER_ERROR",
            message: "Lỗi hệ thống khi tạo người dùng"
        });
    }
};
