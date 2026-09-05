import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../../../config/prisma.js';
import logger from '../../../utils/logger.js';
import axios from 'axios';

/**
 * Táº¡o token JWT Ä‘á»ƒ duy trÃ¬ phiÃªn Ä‘Äƒng nháº­p cho user
 * @param {Object} user - Äá»‘i tÆ°á»£ng user cáº§n táº¡o token
 * @param {string} user.user_id - ID cá»§a user
 * @param {string} user.email - Email cá»§a user
 * @param {string} user.role - Vai trÃ² cá»§a user
 * @returns {string} Chuá»—i JWT token
 * @throws {Error} NÃ©m lá»—i náº¿u chÆ°a Ä‘á»‹nh nghÄ©a JWT_SECRET trong biáº¿n mÃ´i trÆ°á»ng
 */
const signToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('Missing JWT_SECRET in environment variables');
  }

  return jwt.sign(
    {
      user_id: user.user_id,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '1d'
    }
  );
};

/**
 * XÃ¡c thá»±c Google ID Token gá»­i tá»« phÃ­a client báº±ng cÃ¡ch gá»i trá»±c tiáº¿p Google Tokeninfo API
 * @param {string} idToken - Chuá»—i Google ID Token nháº­n tá»« phÃ­a client
 * @returns {Promise<Object>} Tráº£ vá» thÃ´ng tin payload cá»§a user tá»« Google náº¿u token há»£p lá»‡
 * @throws {Error} NÃ©m lá»—i 400 náº¿u token khÃ´ng há»£p lá»‡ hoáº·c lá»—i 500 náº¿u khÃ´ng thá»ƒ káº¿t ná»‘i tá»›i Google API
 */
export const verifyGoogleIdToken = async (idToken) => {
  try {
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const error = new Error(errData.error_description || 'MÃ£ xÃ¡c thá»±c Google khÃ´ng há»£p lá»‡');
      error.statusCode = 400;
      throw error;
    }
    return await response.json();
  } catch (err) {
    if (err.statusCode) throw err;
    const error = new Error('KhÃ´ng thá»ƒ káº¿t ná»‘i Ä‘áº¿n dá»‹ch vá»¥ xÃ¡c thá»±c Google');
    error.statusCode = 500;
    throw error;
  }
};

/**
 * Thá»±c hiá»‡n Ä‘Äƒng nháº­p hoáº·c Ä‘Äƒng kÃ½ tÃ i khoáº£n tá»± Ä‘á»™ng khi xÃ¡c thá»±c báº±ng Google ID Token
 * @param {string} idToken - Chuá»—i Google ID Token nháº­n tá»« phÃ­a client
 * @returns {Promise<Object>} Tráº£ vá» Ä‘á»‘i tÆ°á»£ng chá»©a JWT access token vÃ  thÃ´ng tin chi tiáº¿t ngÆ°á»i dÃ¹ng
 * @throws {Error} NÃ©m lá»—i 403 náº¿u tÃ i khoáº£n bá»‹ khÃ³a (BANNED) hoáº·c lá»—i validation khÃ¡c
 */
export const loginOrCreateWithGoogle = async (idToken) => {
  if (!idToken || !idToken.trim()) {
    const error = new Error('Token xÃ¡c thá»±c Google khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng');
    error.statusCode = 400;
    throw error;
  }

  // 1. XÃ¡c thá»±c ID Token vá»›i Google
  const googleUser = await verifyGoogleIdToken(idToken);
  const email = googleUser.email.trim().toLowerCase();

  // 2. TÃ¬m xem email Ä‘Ã£ tá»“n táº¡i trong DB chÆ°a
  let user = await prisma.user.findFirst({
    where: {
      email: {
        equals: email,
        mode: 'insensitive'
      }
    }
  });

  if (user) {
    // Náº¿u tÃ i khoáº£n bá»‹ khÃ³a
    if (user.status === 'BANNED') {
      const error = new Error('TÃ i khoáº£n Ä‘Ã£ bá»‹ khÃ³a');
      error.statusCode = 403;
      throw error;
    }

    // Náº¿u tráº¡ng thÃ¡i lÃ  INACTIVE hoáº·c auth_provider chÆ°a pháº£i GOOGLE, cáº­p nháº­t láº¡i
    if (user.status === 'INACTIVE' || user.type !== 'GOOGLE') {
      user = await prisma.user.update({
        where: { user_id: user.user_id },
        data: {
          status: 'ACTIVE',
          type: 'GOOGLE'
        }
      });
    }
  } else {
    // ÄÄƒng kÃ½ má»›i tÃ i khoáº£n báº±ng Google
    user = await prisma.user.create({
      data: {
        user_id: crypto.randomUUID(),
        email: email,
        type: 'GOOGLE',
        status: 'ACTIVE',
        role: 'STUDENT',
        first_name: googleUser.given_name || null,
        last_name: googleUser.family_name || null,
        url_image: googleUser.picture || null
      }
    });
  }

  const token = signToken(user);

  return {
    token,
    user: {
      user_id: user.user_id,
      email: user.email,
      role: user.role
    }
  };
};

/**
 * HÃ m Ä‘á»•i Authorization Code láº¥y id_token tá»« Google
 * @param {string} code - MÃ£ code nháº­n tá»« useGoogleLogin (chuá»—i 4/0A...)
 * @returns {Promise<string|null>} - Tráº£ vá» chuá»—i id_token (JWT) náº¿u thÃ nh cÃ´ng
 */
export const getTokenId = async (code) => {
  // 1. Cáº¥u hÃ¬nh cÃ¡c thÃ´ng sá»‘ cáº§n thiáº¿t
  const tokenUrl = process.env.TOKEN_URL;
  
  const payload = {
    code: code,
    client_id: process.env.CLIENT_ID, 
    client_secret: process.env.CLIENT_SECRET, 
    redirect_uri: process.env.FRONTEND_URL,                    
    grant_type: 'authorization_code',
  };

  try {
    // 2. Thá»±c hiá»‡n gá»i API vá»›i Ä‘á»‹nh dáº¡ng x-www-form-urlencoded
    const response = await axios.post(tokenUrl, payload, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    // 3. Google tráº£ vá» data thÃ nh cÃ´ng, láº¥y ra id_token
    if (response.data && response.data.id_token) {
      console.log('Láº¥y id_token thÃ nh cÃ´ng!');
      return response.data.id_token; // ÄÃ¢y lÃ  chuá»—i JWT báº¡n cáº§n Ä‘em vá» Backend
    }
    
    return null;
  } catch (error) {
    logger.error(
      'Lá»—i khi Ä‘á»•i code láº¥y id_token:', 
      error.response?.data || error.message
    );
    throw error;
  }
};


