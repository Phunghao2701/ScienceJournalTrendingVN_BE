import { PrismaClient } from '@prisma/client';
import { getAllArticles, countAllArticles, getArticleListStats } from './src/modules/article/services/article.service.js';

const prisma = new PrismaClient();

async function test() {
    const serviceParams = {
        limit: 10, offset: 0, search: "", sortBy: "created_at", sortOrder: "DESC",
        scope: "vn_universities"
    };

    console.time('getAllArticles');
    await getAllArticles(serviceParams);
    console.timeEnd('getAllArticles');

    console.time('countAllArticles');
    await countAllArticles(serviceParams);
    console.timeEnd('countAllArticles');

    console.time('getArticleListStats');
    await getArticleListStats(serviceParams);
    console.timeEnd('getArticleListStats');

    process.exit(0);
}

test();
