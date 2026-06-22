import pool from '../config/database.js';
import logger from '../utils/logger.js';

export const search = async (keyword, limit = 20) => {
  try {
    const query = `
      SELECT
        id,
        name,
        type
    FROM (
        SELECT
            journal_id::text AS id,
            display_name AS name,
            'JOURNAL' AS type
        FROM "Journal"

        UNION ALL

        SELECT
            author_id::text,
            display_name,
            'AUTHOR'
        FROM "Author"

        UNION ALL

        SELECT
            article_id::text,
            title,
            'ARTICLE'
        FROM "Article"

        UNION ALL

        SELECT
            keyword_id::text,
            display_name,
            'KEYWORD'
        FROM "Keyword"

        UNION ALL

        SELECT
            subject_area_id::text,
            display_name,
            'AREA'
        FROM "Subject_Area"

        UNION ALL

        SELECT
            subject_category_id::text,
            display_name,
            'CATEGORY'
        FROM "Subject_Category"
    ) s
    WHERE LOWER(name) LIKE LOWER($1)
    ORDER BY name
    LIMIT 20;
    `;

    const values = [`%${keyword.trim()}%`];

    const result = await pool.query(query, values);

    return result.rows;
  } catch (error) {
    logger.error("Lỗi khi search:", error);
    logger.error(error.position);
    throw error;
  }
};