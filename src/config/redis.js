import Redis from "ioredis";
import dotenv from "dotenv";
import logger from "../utils/logger.js";

dotenv.config();

// Lazy connection keeps test/import-only processes from opening a Redis socket.
// The first cache command connects automatically in the running application.
const redis = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379", {
  maxRetriesPerRequest: 1,
  connectTimeout: 3000,
  commandTimeout: 1500,
  lazyConnect: true,
});

redis.on("connect", () => {
  logger.db("Ket noi toi Redis thanh cong");
});

let redisErrorLogged = false;
redis.on("error", (err) => {
  if (!redisErrorLogged) {
    logger.warn("Redis tam thoi khong kha dung, bo qua cache.");
    redisErrorLogged = true;
  }
});

export default redis;
