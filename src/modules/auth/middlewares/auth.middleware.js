import jwt from 'jsonwebtoken';
import logger from '../../../utils/logger.js';
import { createLog } from '../../system/services/log.service.js';

export const requireAuth = async (request, reply) => {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        success: false,
        message: 'Không tìm thấy token xác thực hoặc token không hợp lệ'
      });
    }

    const token = authHeader.split(' ')[1];
    if (!process.env.JWT_SECRET) {
      return reply.status(500).send({
        success: false,
        message: 'Lỗi cấu hình JWT trên server'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    request.user = decoded;
  } catch (error) {
    return reply.status(401).send({
      success: false,
      message: 'Token xác thực không hợp lệ hoặc đã hết hạn'
    });
  }
};

export const verifyToken = async (request, reply) => {
  let accessToken = null;

  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    accessToken = authHeader.split(' ')[1];
  }

  if (!accessToken && request.cookies) {
    accessToken = request.cookies.access_token;
  }

  if (!accessToken) {
    return reply.status(401).send({
      success: false,
      code: "ACCESS_TOKEN_MISSING",
      message: "Bạn chưa đăng nhập hoặc phiên l� m việc đã hết hạn"
    });
  }

  try {
    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
    request.user = decoded; 
  } catch (error) {
    return reply.status(401).send({
      success: false,
      code: "ACCESS_TOKEN_EXPIRED",
      message: "Access token không hợp lệ hoặc đã hết hạn"
    });
  }
};

export const verifyAdmin = async (request, reply) => {
  if (!request.user) {
    return reply.status(401).send({
      success: false,
      message: 'Xác thực không th� nh công, không tìm thấy thông tin người dùng.',
      code: 'UNAUTHENTICATED'
    });
  }

  if (request.user.role !== 'ADMINISTRATOR') {
    createLog({
      userId: request.user.user_id,
      userRole: request.user.role,
      action: 'SYSTEM',
      level: 'WARNING',
      message: `T� i khoản ${request.user.email} cố gắng truy cập t� i nguyên Admin (Bị từ chối)`,
      metadata: { ip: request.ip, path: request.url }
    });
    return reply.status(403).send({
      success: false,
      message: 'Bạn không có quyền truy cập t� i nguyên n� y',
      code: 'NO_PERMISSION'
    });
  }
};


