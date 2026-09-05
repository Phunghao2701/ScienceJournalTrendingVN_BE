import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '../../../config/prisma.js';
import { emailHelper } from '../../../utils/email.js';

// Helper to hash token using SHA-256
export const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Gá»­i yÃªu cáº§u quÃªn máº­t kháº©u
 * @param {string} email
 * @returns {Promise<Object>}
 */
export const requestPasswordReset = async (email) => {
  const normalizedEmail = email.trim().toLowerCase();

  // TÃ¬m user theo email
  const user = await prisma.user.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: 'insensitive'
      }
    },
    select: { user_id: true, first_name: true, type: true }
  });

  // Äá»ƒ trÃ¡nh lá»™ tÃ i khoáº£n, náº¿u email khÃ´ng tá»“n táº¡i, tráº£ vá» success: true nhÆ°ng khÃ´ng lÃ m gÃ¬ tiáº¿p theo
  if (!user) {
    return {
      success: true,
      message: 'Náº¿u email tá»“n táº¡i trong há»‡ thá»‘ng, link Ä‘áº·t láº¡i máº­t kháº©u sáº½ Ä‘Æ°á»£c gá»­i Ä‘áº¿n email cá»§a báº¡n'
    };
  }

  // Chá»‰ cho phÃ©p reset password vá»›i tÃ i khoáº£n type = LOCAL
  if (user.type !== 'LOCAL') {
    const error = new Error('TÃ i khoáº£n khÃ´ng há»— trá»£ reset password báº±ng email/password');
    error.statusCode = 403;
    error.code = 'RESET_PASSWORD_NOT_SUPPORTED';
    throw error;
  }

  // Táº¡o reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(resetToken);

  // Set háº¡n sá»­ dá»¥ng 15 phÃºt
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  // LÆ°u token Ä‘Ã£ hash vÃ o database
  await prisma.password_Reset_Token.create({
    data: {
      user_id: user.user_id,
      token_hash: tokenHash,
      expires_at: expiresAt
    }
  });

  // Gá»­i email chá»©a link reset password cho ngÆ°á»i dÃ¹ng
  await emailHelper.sendResetPasswordEmail(normalizedEmail, user.first_name, resetToken);

  return {
    success: true,
    message: 'Náº¿u email tá»“n táº¡i trong há»‡ thá»‘ng, link Ä‘áº·t láº¡i máº­t kháº©u sáº½ Ä‘Æ°á»£c gá»­i Ä‘áº¿n email cá»§a báº¡n'
  };
};

/**
 * Äáº·t láº¡i máº­t kháº©u
 * @param {string} token
 * @param {string} newPassword
 * @returns {Promise<Object>}
 */
export const resetPassword = async (token, newPassword) => {
  const tokenHash = hashToken(token);

  // Truy váº¥n láº¥y token thÃ´ng tin
  const tokenData = await prisma.password_Reset_Token.findFirst({
    where: { token_hash: tokenHash },
    select: { token_id: true, user_id: true, expires_at: true, used_at: true }
  });

  if (!tokenData) {
    const error = new Error('Token khÃ´ng há»£p lá»‡ hoáº·c Ä‘Ã£ háº¿t háº¡n');
    error.statusCode = 400;
    error.code = 'INVALID_OR_EXPIRED_TOKEN';
    throw error;
  }

  // Kiá»ƒm tra Ä‘Ã£ sá»­ dá»¥ng
  if (tokenData.used_at) {
    const error = new Error('Token khÃ´ng há»£p lá»‡ hoáº·c Ä‘Ã£ háº¿t háº¡n');
    error.statusCode = 400;
    error.code = 'INVALID_OR_EXPIRED_TOKEN';
    throw error;
  }

  // Kiá»ƒm tra háº¿t háº¡n
  const now = new Date();
  if (new Date(tokenData.expires_at) <= now) {
    const error = new Error('Token khÃ´ng há»£p lá»‡ hoáº·c Ä‘Ã£ háº¿t háº¡n');
    error.statusCode = 400;
    error.code = 'INVALID_OR_EXPIRED_TOKEN';
    throw error;
  }

  // Hash máº­t kháº©u má»›i báº±ng bcryptjs
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(newPassword, salt);

  // Báº¯t Ä‘áº§u transaction Ä‘á»ƒ update password vÃ  cáº­p nháº­t tráº¡ng thÃ¡i token
  await prisma.$transaction([
    prisma.user.update({
      where: { user_id: tokenData.user_id },
      data: { password: passwordHash }
    }),
    prisma.password_Reset_Token.update({
      where: { token_id: tokenData.token_id },
      data: { used_at: new Date() }
    })
  ]);

  return {
    success: true,
    message: 'Äáº·t láº¡i máº­t kháº©u thÃ nh cÃ´ng'
  };
};




