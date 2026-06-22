import express from 'express';
import cors from 'cors';
import rootRouter from './routes/index.js';
import cookieParser from 'cookie-parser';

const app = express();

// Cấu hình Middleware hệ thống
app.use(cors({
  origin: process.env.FRONTEND_URL, // Ghi đích danh tên miền/port của Frontend, KHÔNG được dùng dấu '*'
  credentials: true                // Cho phép nhận và xử lý Cookie gửi lên
}));
app.use(cookieParser());
app.use(express.json());


// Định tuyến gốc: Tất cả API sẽ bắt đầu bằng /api/v1
app.use('/api/v1', rootRouter);

export default app;