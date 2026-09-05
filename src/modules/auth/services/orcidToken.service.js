import axios from "axios";
import redis from '../../../config/redis.js';
import logger from '../../../utils/logger.js';

const TOKEN_CACHE_KEY = "orcid:public-api:access-token";
const TOKEN_EXPIRY_SAFETY_SECONDS = 60;

let memoryToken = null;
let tokenRefreshPromise = null;

const getMemoryToken = () => {
  if (!memoryToken || memoryToken.expiresAt <= Date.now()) return null;
  return memoryToken.value;
};

const readRedisToken = async (redisClient) => {
  try {
    return await redisClient.get(TOKEN_CACHE_KEY);
  } catch (error) {
    logger.error("[ORCID Token] KhÃ´ng thá»ƒ Ä‘á»c token tá»« Redis:", error.message);
    return null;
  }
};

const writeRedisToken = async (redisClient, token, ttlSeconds) => {
  try {
    await redisClient.set(TOKEN_CACHE_KEY, token, "EX", ttlSeconds);
  } catch (error) {
    logger.error("[ORCID Token] KhÃ´ng thá»ƒ cache token vÃ o Redis:", error.message);
  }
};

export const invalidateOrcidToken = async ({
  redisClient = redis,
} = {}) => {
  memoryToken = null;
  try {
    await redisClient.del(TOKEN_CACHE_KEY);
  } catch (error) {
    logger.error("[ORCID Token] KhÃ´ng thá»ƒ xÃ³a token Redis:", error.message);
  }
};

export const getOrcidAccessToken = async ({
  forceRefresh = false,
  httpClient = axios,
  redisClient = redis,
} = {}) => {
  if (!forceRefresh) {
    const cachedInMemory = getMemoryToken();
    if (cachedInMemory) return cachedInMemory;

    const cachedInRedis = await readRedisToken(redisClient);
    if (cachedInRedis) {
      memoryToken = {
        value: cachedInRedis,
        expiresAt: Date.now() + 5 * 60 * 1000,
      };
      return cachedInRedis;
    }
  } else if (!tokenRefreshPromise) {
    await invalidateOrcidToken({ redisClient });
  }

  if (!tokenRefreshPromise) {
    tokenRefreshPromise = (async () => {
      const clientId = process.env.ORCID_CLIENT_ID;
      const clientSecret = process.env.ORCID_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        const error = new Error(
          "Thiáº¿u ORCID_CLIENT_ID hoáº·c ORCID_CLIENT_SECRET",
        );
        error.code = "ORCID_CONFIGURATION_ERROR";
        throw error;
      }

      const payload = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
        scope: "/read-public",
      });

      const response = await httpClient.post(
        process.env.ORCID_TOKEN_URL || "https://orcid.org/oauth/token",
        payload,
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
          },
          timeout: 5000,
        },
      );

      const token = response.data?.access_token;
      if (!token) {
        const error = new Error("ORCID khÃ´ng tráº£ vá» access token");
        error.code = "ORCID_TOKEN_INVALID_RESPONSE";
        throw error;
      }

      const expiresIn = Math.max(
        Number(response.data.expires_in) || 3600,
        120,
      );
      const ttlSeconds = Math.max(
        expiresIn - TOKEN_EXPIRY_SAFETY_SECONDS,
        TOKEN_EXPIRY_SAFETY_SECONDS,
      );

      memoryToken = {
        value: token,
        expiresAt: Date.now() + ttlSeconds * 1000,
      };
      await writeRedisToken(redisClient, token, ttlSeconds);

      return token;
    })();
  }

  try {
    return await tokenRefreshPromise;
  } finally {
    tokenRefreshPromise = null;
  }
};

export const resetOrcidTokenMemoryCacheForTests = () => {
  memoryToken = null;
  tokenRefreshPromise = null;
};



