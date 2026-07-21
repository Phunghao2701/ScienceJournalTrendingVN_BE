import app from "./src/app.js";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";
import cors from 'cors';
import { warmArticleDiscoveryCache } from "./src/services/articleDiscoveryCache.service.js";
import { warmDiscoveryLookupCache } from "./src/services/discoveryLookupCache.service.js";
import logger from "./src/utils/logger.js";

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

const startServer = async () => {
  try {
    const warmup = await Promise.race([
      (async () => {
        const articleWarmup = await warmArticleDiscoveryCache();
        const lookupWarmup = await warmDiscoveryLookupCache();
        return {
          skipped: articleWarmup.skipped && lookupWarmup.skipped,
          durationMs: articleWarmup.durationMs + lookupWarmup.durationMs,
        };
      })(),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Cache warm-up timeout after 20 seconds")), 20_000);
      }),
    ]);

    if (!warmup.skipped) {
      logger.info(`Article discovery cache warm-up hoàn tất trong ${warmup.durationMs}ms`);
    }
  } catch (error) {
    logger.warn(`Bỏ qua cache warm-up: ${error.message}`);
  }

  app.listen(PORT, () => {
    console.log(`🚀 Server đang trên: http://localhost:${PORT}`);
  });
};

void startServer();
