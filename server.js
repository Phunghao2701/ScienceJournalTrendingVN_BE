import buildApp from "./src/app.js";
import dotenv from "dotenv";

// Hỗ trợ serialize BigInt (được trả về bởi Prisma COUNT/AVG) sang String khi gửi qua API
BigInt.prototype.toJSON = function () {
  return this.toString();
};

import {
  closeOrcidScanWorker,
  startOrcidScanWorker,
} from "./src/modules/author/services/orcidScanWorker.service.js";
import { closeOrcidScanQueue } from "./src/modules/author/services/orcidScanQueue.service.js";

dotenv.config();
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  const app = await buildApp();

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`ðŸš€ Server Ä‘ang cháº¡y trÃªn: http://localhost:${PORT}`);
    startOrcidScanWorker();
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  const shutdown = async () => {
    await app.close();
    await Promise.allSettled([
      closeOrcidScanWorker(),
      closeOrcidScanQueue(),
    ]);
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
};

startServer();

