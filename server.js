import app from "./src/app.js";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";
import cors from 'cors';
import {
  closeOrcidScanWorker,
  startOrcidScanWorker,
} from "./src/services/orcidScanWorker.service.js";
import { closeOrcidScanQueue } from "./src/services/orcidScanQueue.service.js";

dotenv.config();
const PORT = process.env.PORT || 5000;

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Tuyển Tập API Express của Tôi",
      version: "1.0.0",
      description: "Tài liệu hướng dẫn sử dụng các API hệ thống",
    },
    servers: [
      {
        url: process.env.BASE_URL || `http://localhost:${PORT}`,
        description: "API Server",
      },
    ],

    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
  },
  apis: ["./src/routes/*.js"],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

const server = app.listen(PORT, () => {
  console.log(`🚀 Server đang trên: http://localhost:${PORT}`);
  startOrcidScanWorker();
});

const shutdown = async () => {
  server.close();
  await Promise.allSettled([
    closeOrcidScanWorker(),
    closeOrcidScanQueue(),
  ]);
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
