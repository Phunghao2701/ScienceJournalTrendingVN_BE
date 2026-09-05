// H� m lấy thời gian hiện tại theo định dạng chuẩn YYYY-MM-DD HH:mm:ss
const getTimestamp = () => {
  const now = new Date();
  return now.toISOString().replace('T', ' ').substring(0, 19);
};

const logger = {
  info: (message, ...args) => {
    if (process.env.NODE_ENV !== 'test') console.log(`[${getTimestamp()}] [INFO]: ${message}`, ...args);
  },
  
  warn: (message, ...args) => {
    if (process.env.NODE_ENV !== 'test') console.warn(`\x1b[33m[${getTimestamp()}] [WARN]: ${message}\x1b[0m`, ...args); 
    // \x1b[33m v�  \x1b[0m l�  mã m� u giúp chữ WARN có m� u v� ng trên terminal
  },
  
  error: (message, error = '') => {
    if (process.env.NODE_ENV !== 'test') console.error(`\x1b[31m[${getTimestamp()}] [ERROR]: ${message}\x1b[0m`, error.stack || error);
    // Mã m� u đỏ cho ERROR v�  in ra stack trace của lỗi nếu có
  },
  
  db: (message, ...args) => {
    if (process.env.NODE_ENV !== 'test') console.log(`\x1b[36m[${getTimestamp()}] [DATABASE]: ${message}\x1b[0m`, ...args);
    // Mã m� u xanh ngọc (Cyan) d� nh riêng cho các log liên quan đến DB
  }
};

export default logger;