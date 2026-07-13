import redis from "../config/redis.js";
import logger from "./logger.js";

const DEFAULT_TTL_SECONDS = 30 * 60; // 30 phút, phù hợp với tần suất import dữ liệu (vài ngày/tuần một lần)

// Sinh cache key ổn định từ tên hàm và params, không phụ thuộc thứ tự khai báo params.
export const buildCacheKey = (name, params = {}) => {
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  const suffix = entries.map(([key, value]) => `${key}=${value}`).join(":");
  return suffix ? `trending:${name}:${suffix}` : `trending:${name}`;
};

// Cache-aside: đọc Redis trước, nếu miss (hoặc Redis lỗi) thì chạy fetchFn rồi ghi lại cache.
// Redis lỗi không được làm fail request - luôn fallback về fetchFn.
export const getOrSetCache = async (key, fetchFn, ttlSeconds = DEFAULT_TTL_SECONDS) => {
  try {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);
  } catch (err) {
    logger.error(`Đọc cache Redis thất bại cho key "${key}"`, err);
  }

  const data = await fetchFn();

  try {
    await redis.set(key, JSON.stringify(data), "EX", ttlSeconds);
  } catch (err) {
    logger.error(`Ghi cache Redis thất bại cho key "${key}"`, err);
  }

  return data;
};
