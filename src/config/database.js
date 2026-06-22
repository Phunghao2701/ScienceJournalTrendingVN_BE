import pkg from "pg";
import dotenv from "dotenv";
import logger from "../utils/logger.js";

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,

  ssl: {
    rejectUnauthorized: false,
  },

  // Pool config
  max: 20, // Số lượng kết nối tối đa trong pool
  idleTimeoutMillis: 30000, // Đóng các kết nối không dùng sau 30 giây
  connectionTimeoutMillis: 10000, // Timeout kết nối
});

// Kiểm tra kết nối khi khởi động server
pool.query("SELECT NOW()", (err, res) => {
  if (err) {
    logger.error("Kết nối tới PostgreSQL thất bại!", err);
  } else {
    logger.db(`Kết nối tới PostgreSQL thành công lúc: ${res.rows[0].now}`);
  }
});

export default pool;
