import * as userService from "../services/user.service.js";
import logger from "../utils/logger.js";

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
  try{
    const userId = req.user.user_id;
    const user = await userService.getUserById(userId);

    return res.status(200).json({
      success: false,
      code: "SUCCESS_GET_USER",
      data: user
    });
  }catch(error){
    return res.status(error.statusCode || 500).json({
      success: false,
      code: "SERVER_ERROR",
      message: error.statusCode ? error.message : "Có lỗi xảy ra ở Server!",
    });
  }
}