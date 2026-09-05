import jwt from 'jsonwebtoken';
import logger from '../../../utils/logger.js';
import { createLog } from '../../system/services/log.service.js';

export const requireAuth = async (request, reply) => {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        success: false,
        message: 'KhÃ´ng tÃ¬m tháº¥y token xÃ¡c thá»±c hoáº·c token khÃ´ng há»£p lá»‡'
      });
    }

    const token = authHeader.split(' ')[1];
    if (!process.env.JWT_SECRET) {
      return reply.status(500).send({
        success: false,
        message: 'Lá»—i cáº¥u hÃ¬nh JWT trÃªn server'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    request.user = decoded;
  } catch (error) {
    return reply.status(401).send({
      success: false,
      message: 'Token xÃ¡c thá»±c khÃ´ng há»£p lá»‡ hoáº·c Ä‘Ã£ háº¿t háº¡n'
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
      message: "Báº¡n chÆ°a Ä‘Äƒng nháº­p hoáº·c phiÃªn lÃ m viá»‡c Ä‘Ã£ háº¿t háº¡n"
    });
  }

  try {
    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
    request.user = decoded; 
  } catch (error) {
    return reply.status(401).send({
      success: false,
      code: "ACCESS_TOKEN_EXPIRED",
      message: "Access token khÃ´ng há»£p lá»‡ hoáº·c Ä‘Ã£ háº¿t háº¡n"
    });
  }
};

export const verifyAdmin = async (request, reply) => {
  if (!request.user) {
    return reply.status(401).send({
      success: false,
      message: 'XÃ¡c thá»±c khÃ´ng thÃ nh cÃ´ng, khÃ´ng tÃ¬m tháº¥y thÃ´ng tin ngÆ°á»i dÃ¹ng.',
      code: 'UNAUTHENTICATED'
    });
  }

  if (request.user.role !== 'ADMINISTRATOR') {
    createLog({
      userId: request.user.user_id,
      userRole: request.user.role,
      action: 'SYSTEM',
      level: 'WARNING',
      message: `TÃ i khoáº£n ${request.user.email} cá»‘ gáº¯ng truy cáº­p tÃ i nguyÃªn Admin (Bá»‹ tá»« chá»‘i)`,
      metadata: { ip: request.ip, path: request.url }
    });
    return reply.status(403).send({
      success: false,
      message: 'Báº¡n khÃ´ng cÃ³ quyá»n truy cáº­p tÃ i nguyÃªn nÃ y',
      code: 'NO_PERMISSION'
    });
  }
};


