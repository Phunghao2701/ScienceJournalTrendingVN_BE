import pkg from "pg";
import dotenv from "dotenv";
import logger from "../utils/logger.js";

dotenv.config();

const { Pool } = pkg;

const url = process.env.POSTGRES_URL || "";
const isLocalOrPrivate =
  url.includes("localhost") ||
  url.includes("127.0.0.1") ||
  url.includes("100.") ||
  url.includes("192.168.") ||
  url.includes("10.") ||
  url.includes("172.");

const pool = new Pool({
  connectionString: url,
  ssl: (!isLocalOrPrivate && url.includes("supabase.com")) ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.query("SELECT NOW()", (err, res) => {
  if (err) {
    logger.error("Ket noi toi PostgreSQL that bai!", err);
  } else {
    logger.db(`Ket noi toi PostgreSQL thanh cong luc: ${res.rows[0].now}`);
  }
});

export default pool;
