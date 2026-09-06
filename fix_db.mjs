import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Bookmark" (
        bookmark_id BIGSERIAL PRIMARY KEY,
        user_id UUID NOT NULL,
        article_id BIGINT NOT NULL,
        created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, article_id)
      );
    `);
    console.log('Table Bookmark created successfully!');
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
run();
