import prisma from '../../../config/prisma.js';
import logger from '../../../utils/logger.js';

/**
 * Xóa t� i khoản theo user_id
 * @param {string} userId 
 * @returns {Promise<Object>}
 */
export const deleteUserById = async (userId) => {
  try {
    const deletedUser = await prisma.user.delete({
      where: { user_id: userId },
      select: { user_id: true, email: true }
    });
    return deletedUser;
  } catch (error) {
    if (error.code === 'P2025') { // Prisma error code for Record to delete does not exist
      const customError = new Error('T� i khoản không tồn tại hoặc đã bị xóa trước đó');
      customError.statusCode = 404;
      throw customError;
    }
    throw error;
  }
};

/**
 * Cập nhật thông tin t� i khoản người dùng
 * @param {string} userId 
 * @param {Object} updateData 
 * @returns {Promise<Object>}
 */
export const updateUserProfile = async (userId, updateData) => {
  const allowedFields = ['first_name', 'last_name', 'date_of_birth', 'gender', 'url_image'];
  const dataToUpdate = {};

  for (const field of allowedFields) {
    if (updateData[field] !== undefined) {
      if (field === 'date_of_birth' && updateData[field]) {
        dataToUpdate[field] = new Date(updateData[field]);
      } else {
        dataToUpdate[field] = updateData[field];
      }
    }
  }

  if (Object.keys(dataToUpdate).length === 0) {
    // Nếu không truyền dữ liệu gì đổi, trả về thông tin user hiện tại
    const user = await prisma.user.findUnique({
      where: { user_id: userId },
      select: { user_id: true, email: true, first_name: true, last_name: true, date_of_birth: true, gender: true, url_image: true, role: true, status: true, type: true }
    });
    return user;
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { user_id: userId },
      data: dataToUpdate,
      select: { user_id: true, email: true, first_name: true, last_name: true, date_of_birth: true, gender: true, url_image: true, role: true, status: true, type: true }
    });
    return updatedUser;
  } catch (error) {
    if (error.code === 'P2025') {
      const customError = new Error('Không tìm thấy t� i khoản để cập nhật');
      customError.statusCode = 404;
      throw customError;
    }
    throw error;
  }
};

export const getUserById = async (userId) => {
  try {
    const user = await prisma.user.findUnique({
      where: { user_id: userId },
      select: {
        user_id: true,
        email: true,
        first_name: true,
        last_name: true,
        date_of_birth: true,
        gender: true,
        url_image: true,
        role: true,
        status: true,
        type: true
      }
    });

    return user;
  } catch (error) {
    logger.error(`Lỗi database trong h� m getUserById với id ${userId}:`, error);
    throw error;
  }
};


