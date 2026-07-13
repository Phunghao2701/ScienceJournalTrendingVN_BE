import Redis from "ioredis";
import dotenv from "dotenv";
import logger from "../utils/logger.js";

dotenv.config();

const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: 2,
  lazyConnect: false,
});

redis.on("connect", () => {
  logger.db("Kết nối tới Redis thành công");
});

redis.on("error", (err) => {
  logger.error("Kết nối tới Redis thất bại!", err);
});

export default redis;
