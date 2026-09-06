import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
    console.time('EXISTS query');
    await prisma.$queryRawUnsafe(`
        SELECT a."article_id"
        FROM "Article" a
        WHERE a."is_deleted" = false
          AND a."is_vn_journal" IS TRUE
          AND EXISTS (
            SELECT 1
            FROM "Author_Article" scope_aa
            JOIN "Author" scope_author ON scope_author."author_id" = scope_aa."author_id"
              AND COALESCE(scope_author."is_deleted", false) = false
            JOIN "Institution_Author" scope_ia ON scope_ia."author_id" = scope_aa."author_id"
            JOIN "Institution" scope_inst ON scope_inst."institution_id" = scope_ia."institution_id"
              AND COALESCE(scope_inst."is_deleted", false) = false
            WHERE scope_aa."article_id" = a."article_id"
              AND scope_ia."year" = a."publication_year"
              AND UPPER(TRIM(scope_inst."country_code")) = 'VN'
          )
        ORDER BY a."created_at" DESC
        LIMIT 10 OFFSET 0
    `);
    console.timeEnd('EXISTS query');

    console.time('JOIN query');
    await prisma.$queryRawUnsafe(`
        SELECT a."article_id"
        FROM "Article" a
        JOIN "Author_Article" scope_aa ON scope_aa."article_id" = a."article_id"
        JOIN "Institution_Author" scope_ia ON scope_ia."author_id" = scope_aa."author_id" AND scope_ia."year" = a."publication_year"
        JOIN "Institution" scope_inst ON scope_inst."institution_id" = scope_ia."institution_id" AND UPPER(TRIM(scope_inst."country_code")) = 'VN'
        WHERE a."is_deleted" = false
          AND a."is_vn_journal" IS TRUE
          AND COALESCE(scope_inst."is_deleted", false) = false
        GROUP BY a."article_id"
        ORDER BY MAX(a."created_at") DESC
        LIMIT 10 OFFSET 0
    `);
    console.timeEnd('JOIN query');

    process.exit(0);
}

test();
