import prisma from '../../../config/prisma.js';
import logger from '../../../utils/logger.js';

/**
 * Láº¥y danh sÃ¡ch cÃ¡c project cá»§a má»™t user
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export const getUserProjects = async (userId) => {
  const result = await prisma.$queryRawUnsafe(
    `SELECT
       p.project_id,
       p.title,
       p.subject_area,
       sa.display_name AS subject_area_name,
       COUNT(DISTINCT pj.journal_id)::integer AS journals_count,
       p.created_at
     FROM "Project" p
     LEFT JOIN "Subject_Area" sa ON p.subject_area = sa.subject_area_id
     LEFT JOIN "Project_Journal" pj ON p.project_id = pj.project_id
     WHERE p.user_id = $1::uuid
     GROUP BY
       p.project_id,
       p.title,
       p.subject_area,
       sa.display_name,
       p.created_at
     ORDER BY p.created_at DESC`,
    userId
  );
  return result;
};

/**
 * Láº¥y chi tiáº¿t má»™t project bao gá»“m cáº¥u hÃ¬nh Subject Area, Subject Categories vÃ�  Journals
 * @param {string|number} projectId
 * @param {string} userId
 * @returns {Promise<Object|null>}
 */
export const getProjectById = async (projectId, userId) => {
  // 1. Láº¥y thÃ´ng tin chung cá»§a project vÃ�  Subject Area tÆ°Æ¡ng á»©ng
  const projectResult = await prisma.$queryRawUnsafe(
    `SELECT p.project_id, p.title, p.user_id, p.subject_area, p.created_at,
            sa.display_name as subject_area_name, sa.description as subject_area_description
     FROM "Project" p
     LEFT JOIN "Subject_Area" sa ON p.subject_area = sa.subject_area_id
     WHERE p.project_id = $1 AND p.user_id = $2`,
    projectId, userId
  );

  if (projectResult.length === 0) {
    return null;
  }

  const project = projectResult[0];

  // 2. Láº¥y danh sÃ¡ch Subject Category Ä‘Ã£ cáº¥u hÃ¬nh
  const categoriesResult = await prisma.$queryRawUnsafe(
    `SELECT sc.subject_category_id, sc.display_name, sc.description, sc.subject_area_id
     FROM "Subject_Category_Project" psc
     JOIN "Subject_Category" sc ON psc.subject_category_id = sc.subject_category_id
     WHERE psc.project_id = $1`,
    projectId
  );

  // 3. Láº¥y danh sÃ¡ch Journal Ä‘Ã£ cáº¥u hÃ¬nh
  const journalsResult = await prisma.$queryRawUnsafe(
    `SELECT j.journal_id, j.display_name, j.issn, j.type, j.is_open_access
     FROM "Project_Journal" pj
     JOIN "Journal" j ON pj.journal_id = j.journal_id
     WHERE pj.project_id = $1`,
    projectId
  );

  // 4. Láº¥y danh sÃ¡ch keyword mÃ�  project Ä‘ang theo dÃµi
  const keywordsResult = await prisma.$queryRawUnsafe(
    `SELECT k.keyword_id, k.display_name
     FROM "Project_Keyword" pk
     JOIN "Keyword" k ON pk.keyword_id = k.keyword_id
     WHERE pk.project_id = $1
     ORDER BY k.display_name ASC`,
    projectId
  );

  return {
    project_id: project.project_id,
    title: project.title,
    user_id: project.user_id,
    created_at: project.created_at,
    subject_area: project.subject_area ? {
      subject_area_id: project.subject_area,
      display_name: project.subject_area_name,
      description: project.subject_area_description
    } : null,
    subject_categories: categoriesResult,
    journals: journalsResult,
    watched_keywords: keywordsResult
  };
};

/**
 * Helper Ä‘á»ƒ kiá»ƒm tra danh sÃ¡ch ID cÃ³ tá»“n táº¡i trong báº£ng tÆ°Æ¡ng á»©ng hay khÃ´ng
 * @param {Array<number|string>} ids - Danh sÃ¡ch ID cáº§n kiá»ƒm tra
 * @param {string} tableName - TÃªn báº£ng trong cÆ¡ sá»Ÿ dá»¯ liá»‡u
 * @param {string} idColumnName - TÃªn cá»™t ID cá»§a báº£ng cáº§n kiá»ƒm tra
 * @returns {Promise<boolean>} Tráº£ vá» true náº¿u táº¥t cáº£ cÃ¡c ID Ä‘á»u tá»“n táº¡i, ngÆ°á»£c láº¡i tráº£ vá» false
 */
const validateIdsExist = async (ids, tableName, idColumnName) => {
  if (!ids || ids.length === 0) return true;
  // Loáº¡i bá» cÃ¡c ID trÃ¹ng láº·p
  const uniqueIds = [...new Set(ids)];
  
  // Thá»±c hiá»‡n truy váº¥n Ä‘á»ƒ kiá»ƒm tra xem cÃ¡c ID cÃ³ tá»“n táº¡i khÃ´ng
  const query = `
    SELECT ${idColumnName} 
    FROM "${tableName}" 
    WHERE ${idColumnName} = ANY($1::bigint[])
  `;
  const result = await prisma.$queryRawUnsafe(query, uniqueIds);
  return result.length === uniqueIds.length;
};

/**
 * Táº¡o má»™t dá»± Ã¡n má»›i vÃ�  thiáº¿t láº­p cÃ¡c liÃªn káº¿t chuyÃªn ngÃ� nh / táº¡p chÃ­ tÆ°Æ¡ng á»©ng
 * @param {Object} projectData - ThÃ´ng tin dá»± Ã¡n cáº§n táº¡o
 * @param {string} projectData.userId - ID cá»§a ngÆ°á»i dÃ¹ng sá»Ÿ há»¯u dá»± Ã¡n
 * @param {string} projectData.title - TiÃªu Ä‘á» cá»§a dá»± Ã¡n
 * @param {number|string} [projectData.subject_area] - ID cá»§a lÄ©nh vá»±c nghiÃªn cá»©u chÃ­nh
 * @param {Array<number|string>} [projectData.subject_category_ids] - Danh sÃ¡ch ID danh má»¥c chuyÃªn ngÃ� nh liÃªn káº¿t
 * @param {Array<number|string>} [projectData.journal_ids] - Danh sÃ¡ch ID táº¡p chÃ­ liÃªn káº¿t
 * @returns {Promise<Object>} Tráº£ vá» thÃ´ng tin cÆ¡ báº£n cá»§a project vá»«a Ä‘Æ°á»£c táº¡o
 * @throws {Error} NÃ©m lá»—i náº¿u Subject Area, Subject Category hoáº·c Journal khÃ´ng tá»“n táº¡i
 */
export const createProject = async ({ userId, title, subject_area, subject_category_ids = [], journal_ids = [] }) => {
  // 1. Kiá»ƒm tra sá»± tá»“n táº¡i cá»§a subject_area
  if (subject_area) {
    const areaCheck = await prisma.$queryRawUnsafe(
      `SELECT 1 FROM "Subject_Area" WHERE subject_area_id = $1`,
      subject_area
    );
    if (areaCheck.length === 0) {
      throw new Error(`Subject Area ID '${subject_area}' khÃ´ng tá»“n táº¡i`);
    }
  }

  // 2. Kiá»ƒm tra sá»± tá»“n táº¡i cá»§a táº¥t cáº£ subject_category_ids
  if (subject_category_ids.length > 0) {
    const categoriesValid = await validateIdsExist(subject_category_ids, 'Subject_Category', 'subject_category_id');
    if (!categoriesValid) {
      throw new Error('Má»™t hoáº·c nhiá»u Subject Category ID khÃ´ng tá»“n táº¡i trong há»‡ thá»‘ng');
    }
  }

  // 3. Kiá»ƒm tra sá»± tá»“n táº¡i cá»§a táº¥t cáº£ journal_ids
  if (journal_ids.length > 0) {
    const journalsValid = await validateIdsExist(journal_ids, 'Journal', 'journal_id');
    if (!journalsValid) {
      throw new Error('Má»™t hoáº·c nhiá»u Journal ID khÃ´ng tá»“n táº¡i trong há»‡ thá»‘ng');
    }
  }

  // 4. Báº¯t Ä‘áº§u transaction Ä‘á»ƒ lÆ°u dá»¯ liá»‡u
  return await prisma.$transaction(async (tx) => {
    // ThÃªm báº£n ghi vÃ� o báº£ng Project
    const projectInsertResult = await tx.$queryRawUnsafe(
      `INSERT INTO "Project" (user_id, title, subject_area) 
       VALUES ($1, $2, $3) 
       RETURNING project_id, user_id, title, subject_area, created_at`,
      userId, title, subject_area || null
    );
    const newProject = projectInsertResult[0];
    const projectId = newProject.project_id;

    // ThÃªm cÃ¡c liÃªn káº¿t vÃ� o báº£ng trung gian Subject_Category_Project
    if (subject_category_ids.length > 0) {
      const uniqueCategoryIds = [...new Set(subject_category_ids)];
      for (const catId of uniqueCategoryIds) {
        await tx.$executeRawUnsafe(
          `INSERT INTO "Subject_Category_Project" (project_id, subject_category_id) VALUES ($1, $2)`,
          projectId, catId
        );
      }
    }

    // ThÃªm cÃ¡c liÃªn káº¿t vÃ� o báº£ng trung gian Project_Journal
    if (journal_ids.length > 0) {
      const uniqueJournalIds = [...new Set(journal_ids)];
      for (const journalId of uniqueJournalIds) {
        await tx.$executeRawUnsafe(
          `INSERT INTO "Project_Journal" (project_id, journal_id) VALUES ($1, $2)`,
          projectId, journalId
        );
      }
    }

    return newProject;
  });
};

/**
 * Cáº­p nháº­t thÃ´ng tin cá»§a dá»± Ã¡n, bao gá»“m cáº­p nháº­t liÃªn káº¿t chuyÃªn ngÃ� nh vÃ�  táº¡p chÃ­
 * @param {string|number} projectId - ID cá»§a dá»± Ã¡n cáº§n cáº­p nháº­t
 * @param {string} userId - ID cá»§a ngÆ°á»i dÃ¹ng sá»Ÿ há»¯u dá»± Ã¡n (Ä‘á»ƒ xÃ¡c thá»±c quyá»n)
 * @param {Object} updateData - Dá»¯ liá»‡u cáº­p nháº­t
 * @param {string} [updateData.title] - TiÃªu Ä‘á» má»›i cá»§a dá»± Ã¡n
 * @param {number|string} [updateData.subject_area] - ID má»›i cá»§a lÄ©nh vá»±c nghiÃªn cá»©u chÃ­nh
 * @param {Array<number|string>} [updateData.subject_category_ids] - Danh sÃ¡ch ID danh má»¥c chuyÃªn ngÃ� nh má»›i
 * @param {Array<number|string>} [updateData.journal_ids] - Danh sÃ¡ch ID táº¡p chÃ­ má»›i
 * @returns {Promise<boolean|null>} Tráº£ vá» true náº¿u cáº­p nháº­t thÃ� nh cÃ´ng, null náº¿u dá»± Ã¡n khÃ´ng tá»“n táº¡i hoáº·c khÃ´ng thuá»™c sá»Ÿ há»¯u cá»§a user
 * @throws {Error} NÃ©m lá»—i náº¿u Subject Area, Subject Category hoáº·c Journal má»›i khÃ´ng tá»“n táº¡i
 */
export const updateProject = async (projectId, userId, { title, subject_area, subject_category_ids, journal_ids }) => {
  // 1. Kiá»ƒm tra xem project cÃ³ tá»“n táº¡i vÃ�  thuá»™c sá»Ÿ há»¯u cá»§a user khÃ´ng
  const projectCheck = await prisma.$queryRawUnsafe(
    `SELECT 1 FROM "Project" WHERE project_id = $1 AND user_id = $2`,
    projectId, userId
  );
  if (projectCheck.length === 0) {
    return null;
  }

  // 2. Kiá»ƒm tra sá»± tá»“n táº¡i cá»§a subject_area náº¿u Ä‘Æ°á»£c truyá»n vÃ� o
  if (subject_area) {
    const areaCheck = await prisma.$queryRawUnsafe(
      `SELECT 1 FROM "Subject_Area" WHERE subject_area_id = $1`,
      subject_area
    );
    if (areaCheck.length === 0) {
      throw new Error(`Subject Area ID '${subject_area}' khÃ´ng tá»“n táº¡i`);
    }
  }

  // 3. Kiá»ƒm tra sá»± tá»“n táº¡i cá»§a táº¥t cáº£ subject_category_ids náº¿u Ä‘Æ°á»£c truyá»n vÃ� o
  if (subject_category_ids && subject_category_ids.length > 0) {
    const categoriesValid = await validateIdsExist(subject_category_ids, 'Subject_Category', 'subject_category_id');
    if (!categoriesValid) {
      throw new Error('Má»™t hoáº·c nhiá»u Subject Category ID khÃ´ng tá»“n táº¡i trong há»‡ thá»‘ng');
    }
  }

  // 4. Kiá»ƒm tra sá»± tá»“n táº¡i cá»§a táº¥t cáº£ journal_ids náº¿u Ä‘Æ°á»£c truyá»n vÃ� o
  if (journal_ids && journal_ids.length > 0) {
    const journalsValid = await validateIdsExist(journal_ids, 'Journal', 'journal_id');
    if (!journalsValid) {
      throw new Error('Má»™t hoáº·c nhiá»u Journal ID khÃ´ng tá»“n táº¡i trong há»‡ thá»‘ng');
    }
  }

  // 5. Báº¯t Ä‘áº§u transaction Ä‘á»ƒ cáº­p nháº­t dá»¯ liá»‡u
  await prisma.$transaction(async (tx) => {
    // Cáº­p nháº­t thÃ´ng tin cÆ¡ báº£n cá»§a project
    await tx.$executeRawUnsafe(
      `UPDATE "Project"
       SET title = COALESCE($1, title),
           subject_area = COALESCE($2, subject_area)
       WHERE project_id = $3 AND user_id = $4`,
      title, subject_area ?? null, projectId, userId
    );

    // Cáº­p nháº­t quan há»‡ Subject Category náº¿u máº£ng Ä‘Æ°á»£c truyá»n vÃ� o
    if (subject_category_ids) {
      // XÃ³a cÃ¡c quan há»‡ cÅ©
      await tx.$executeRawUnsafe(`DELETE FROM "Subject_Category_Project" WHERE project_id = $1`, projectId);
      
      // ThÃªm cÃ¡c quan há»‡ má»›i
      if (subject_category_ids.length > 0) {
        const uniqueCategoryIds = [...new Set(subject_category_ids)];
        for (const catId of uniqueCategoryIds) {
          await tx.$executeRawUnsafe(
            `INSERT INTO "Subject_Category_Project" (project_id, subject_category_id) VALUES ($1, $2)`,
            projectId, catId
          );
        }
      }
    }

    // Cáº­p nháº­t quan há»‡ Journal náº¿u máº£ng Ä‘Æ°á»£c truyá»n vÃ� o
    if (journal_ids) {
      // XÃ³a cÃ¡c quan há»‡ cÅ©
      await tx.$executeRawUnsafe(`DELETE FROM "Project_Journal" WHERE project_id = $1`, projectId);
      
      // ThÃªm cÃ¡c quan há»‡ má»›i
      if (journal_ids.length > 0) {
        const uniqueJournalIds = [...new Set(journal_ids)];
        for (const journalId of uniqueJournalIds) {
          await tx.$executeRawUnsafe(
            `INSERT INTO "Project_Journal" (project_id, journal_id) VALUES ($1, $2)`,
            projectId, journalId
          );
        }
      }
    }
  });

  return getProjectById(projectId, userId);
};

/**
 * XÃ³a má»™t project
 * @param {string|number} projectId
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
export const deleteProject = async (projectId, userId) => {
  return await prisma.$transaction(async (tx) => {
    // 1. Kiá»ƒm tra xem project cÃ³ tá»“n táº¡i vÃ�  thuá»™c sá»Ÿ há»¯u cá»§a user hay khÃ´ng
    const checkResult = await tx.$queryRawUnsafe(
      `SELECT 1 FROM "Project" WHERE project_id = $1 AND user_id = $2`,
      projectId, userId
    );
    if (checkResult.length === 0) {
      return false;
    }

    // 2. XÃ³a cÃ¡c báº£n ghi liÃªn quan trong Subject_Category_Project
    await tx.$executeRawUnsafe(
      `DELETE FROM "Subject_Category_Project" WHERE project_id = $1`,
      projectId
    );

    // 3. XÃ³a cÃ¡c báº£n ghi liÃªn quan trong Project_Journal
    await tx.$executeRawUnsafe(
      `DELETE FROM "Project_Journal" WHERE project_id = $1`,
      projectId
    );

    // 4. XÃ³a project chÃ­nh
    await tx.$executeRawUnsafe(
      `DELETE FROM "Project" WHERE project_id = $1 AND user_id = $2`,
      projectId, userId
    );

    return true;
  });
};


/**
 * Láº¥y danh sÃ¡ch journal_id thuá»™c vá» má»™t dá»± Ã¡n.
 *
 * @async
 * @param {(number|string)} projectId - ID cá»§a dá»± Ã¡n cáº§n truy váº¥n.
 * @returns {Promise<number[]>} Máº£ng cÃ¡c journal_id.
 */
export const getJournalIdsByProjectId = async (projectId) => {
    try {
        const queryText = `
            SELECT pj.journal_id
            FROM "Project_Journal" pj
            WHERE pj.project_id = $1;
        `;

        const res = await prisma.$queryRawUnsafe(queryText, Number(projectId));

        // Chá»‰ tráº£ vá» máº£ng sá»‘
        return res.map(row => Number(row.journal_id));
    } catch (error) {
        logger.error('Lá»—i khi láº¥y journal_id cá»§a dá»± Ã¡n:', error);
        throw error;
    }
};

/**
 * Láº¥y danh sÃ¡ch subject_category_id thuá»™c vá» cÃ¡c journal trong dá»± Ã¡n.
 *
 * @async
 * @param {(number|string)} projectId - ID cá»§a dá»± Ã¡n.
 * @returns {Promise<number[]>} Máº£ng cÃ¡c subject_category_id (khÃ´ng trÃ¹ng).
 */
export const getCategoryIdsByProjectId = async (projectId) => {
    try {
        const queryText = `
            SELECT DISTINCT scp.subject_category_id
            FROM "Subject_Category_Project" scp
            WHERE scp.project_id = $1;
        `;

        const res = await prisma.$queryRawUnsafe(queryText, Number(projectId));

        return res.map(row => Number(row.subject_category_id));
    } catch (error) {
        logger.error('Lá»—i khi láº¥y subject_category_id cá»§a dá»± Ã¡n:', error);
        throw error;
    }
};

/**
 * Láº¥y danh sÃ¡ch cÃ¡c bÃ� i viáº¿t liÃªn quan dá»±a trÃªn máº£ng ID táº¡p chÃ­ HOáº¶C máº£ng ID danh má»¥c thuá»™c dá»± Ã¡n.
 * Æ¯u tiÃªn cÃ¡c bÃ� i viáº¿t thá»a mÃ£n cáº£ hai Ä‘iá»u kiá»‡n, sáº¯p xáº¿p theo nÄƒm xuáº¥t báº£n má»›i nháº¥t.
 *
 * @async
 * @param {Array<number|string>} journalIds - Máº£ng chá»©a cÃ¡c ID cá»§a táº¡p chÃ­ thuá»™c dá»± Ã¡n.
 * @param {Array<number|string>} categoryIds - Máº£ng chá»©a cÃ¡c ID cá»§a danh má»¥c thuá»™c dá»± Ã¡n.
 * @param {Object} options - Cáº¥u hÃ¬nh tÃ¹y chá»n cho dá»¯ liá»‡u.
 * @param {number} [options.limit=5] - Sá»‘ lÆ°á»£ng bÃ� i viáº¿t giá»›i háº¡n láº¥y ra.
 * @returns {Promise<Array<{article_id: (number|string), title: string, abstract: string, publication_year: number, doi: string, journal_name: string}>>} Danh sÃ¡ch bÃ� i viáº¿t gá»£i Ã½.
 */
export const getRelatedArticles = async (journalIds, categoryIds, { limit = 5 }) => {
    try {
        // PhÃ²ng há» trÆ°á»ng há»£p máº£ng truyá»n vÃ� o bá»‹ rá»—ng Ä‘á»ƒ trÃ¡nh lá»—i SQL ANY()
        const finalJournalIds = journalIds.length > 0 ? journalIds : [-1];
        const finalCategoryIds = categoryIds.length > 0 ? categoryIds : [-1];

        const queryText = `
            SELECT DISTINCT
                a.article_id,
                a.title,
                a.abstract,
                a.publication_year,
                a.doi,
                j.display_name AS journal_name, -- Láº¥y ra tÃªn táº¡p chÃ­ tÆ°Æ¡ng á»©ng nhÆ° yÃªu cáº§u bÃ� i toÃ¡n
                COALESCE(
                    (
                        SELECT JSON_AGG(
                            JSON_BUILD_OBJECT(
                                'author_id', au.author_id,
                                'name', au.display_name
                            )
                            ORDER BY au.display_name
                        )
                        FROM "Author_Article" aa
                        JOIN "Author" au ON au.author_id = au.author_id
                        WHERE aa.article_id = a.article_id
                          AND COALESCE(au.is_deleted, false) = false
                    ),
                    '[]'::json
                ) AS authors
            FROM "Article" a
            -- Luá»“ng Ä‘i ngÆ°á»£c cÃ¢y thÆ° má»¥c theo sÆ¡ Ä‘á»“ DB cá»§a báº¡n: Article -> Issue -> Volume -> Journal
            JOIN "Issue" i ON a.issue_id = i.issue_id
            JOIN "Volume" v ON i.volume_id = v.volume_id
            JOIN "Journal" j ON v.journal_id = j.journal_id
            -- Káº¿t ná»‘i sang báº£ng danh má»¥c Ä‘á»ƒ kiá»ƒm tra chuyÃªn ngÃ� nh háº¹p
            LEFT JOIN "Journal_Subject_Category" jc ON j.journal_id = jc.journal_id
            -- Äiá»u kiá»‡n lá»c Ä‘á»™ng "Hoáº·c/VÃ� ": Thá»a mÃ£n táº¡p chÃ­ HOáº¶C thá»a mÃ£n chuyÃªn ngÃ� nh Ä‘á»u láº¥y
            WHERE v.journal_id = ANY($1) 
               OR jc.subject_category_id = ANY($2) 
            -- Sáº¯p xáº¿p: Æ¯u tiÃªn bÃ� i viáº¿t má»›i xuáº¥t báº£n nháº¥t, tiáº¿p theo lÃ�  bÃ� i táº¡o má»›i nháº¥t trong DB
            ORDER BY a.publication_year DESC, a.article_id DESC
            LIMIT $3;
        `;

        const values = [finalJournalIds, finalCategoryIds, limit];
        const res = await prisma.$queryRawUnsafe(queryText, ...values);
        return res; 
        
    } catch (error) {
        logger.error('Lá»—i khi láº¥y bÃ� i viáº¿t liÃªn quan táº¡i Service:', error);
        throw error;
    }
};

/**
 * Láº¥y dá»¯ liá»‡u phÃ¢n tÃ­ch/thá»‘ng kÃª cá»§a má»™t dá»± Ã¡n (Trending Charts)
 * 
 * @async
 * @param {number|string} projectId - ID dá»± Ã¡n.
 * @param {string} userId - ID ngÆ°á»i dÃ¹ng sá»Ÿ há»¯u dá»± Ã¡n.
 * @returns {Promise<Object|null>} Dá»¯ liá»‡u phÃ¢n tÃ­ch hoáº·c null náº¿u dá»± Ã¡n khÃ´ng tá»“n táº¡i/khÃ´ng thuá»™c quyá»n sá»Ÿ há»¯u.
 */
export const getProjectAnalytics = async (projectId, userId) => {
    try {
        // 1. XÃ¡c thá»±c sá»± tá»“n táº¡i vÃ�  quyá»n sá»Ÿ há»¯u dá»± Ã¡n
        const projectCheck = await prisma.$queryRawUnsafe(
            `SELECT 1 FROM "Project" WHERE project_id = $1 AND user_id = $2`,
            Number(projectId), userId
        );
        if (projectCheck.length === 0) {
            return null;
        }

        // 2. Chart 1 (Article Volume Trend)
        const articleTrendQuery = `
            SELECT 
                a.publication_year::integer AS year,
                COUNT(a.article_id)::integer AS article_count
            FROM "Article" a
            JOIN "Issue" i ON a.issue_id = i.issue_id
            JOIN "Volume" v ON i.volume_id = v.volume_id
            JOIN "Project_Journal" pj ON v.journal_id = pj.journal_id
            WHERE pj.project_id = $1 AND a.is_deleted = false
            GROUP BY a.publication_year
            ORDER BY a.publication_year ASC
        `;
        const articleTrendRes = await prisma.$queryRawUnsafe(articleTrendQuery, Number(projectId));

        // 3. Chart 2 (Journal Metrics Comparison)
        const metricsCompareQuery = `
            WITH latest_years AS (
                SELECT jr.journal_id, MAX(jr.year) AS max_year
                FROM "Journal_Ranking" jr
                JOIN "Project_Journal" pj ON jr.journal_id = pj.journal_id
                WHERE pj.project_id = $1
                GROUP BY jr.journal_id
            ),
            deduped_rankings AS (
                SELECT DISTINCT ON (jr.journal_id, rm.code, jr.subject_category_id)
                    j.display_name AS journal_name,
                    j.journal_id::text AS journal_id,
                    rm.code AS metric_code,
                    rm.display_name AS metric_name,
                    rm.metric_type,
                    jr.year,
                    jr.value_txt,
                    jr.value_float,
                    jr.value_int
                FROM "Journal_Ranking" jr
                JOIN latest_years ly ON jr.journal_id = ly.journal_id AND jr.year = ly.max_year
                JOIN "Ranking_Metric" rm ON jr.metric_id = rm.metric_id
                JOIN "Journal" j ON jr.journal_id = j.journal_id
                ORDER BY jr.journal_id, rm.code, jr.subject_category_id, jr.journal_ranking_id DESC
            )
            SELECT * FROM deduped_rankings
            ORDER BY journal_name ASC, metric_code ASC
        `;
        const metricsCompareRes = await prisma.$queryRawUnsafe(metricsCompareQuery, Number(projectId));
        
        const journalMetrics = metricsCompareRes.map(row => {
            let value = null;
            if (row.metric_type === 'QUARTILE') {
                value = row.value_txt;
            } else if (row.metric_type === 'SCORE') {
                value = row.value_float !== null ? Number(row.value_float) : null;
            } else if (row.metric_type === 'INTEGER') {
                value = row.value_int !== null ? Number(row.value_int) : null;
            } else {
                value = row.value_txt !== null ? row.value_txt :
                        row.value_float !== null ? Number(row.value_float) :
                        row.value_int !== null ? Number(row.value_int) : null;
            }
            return {
                journal_name: row.journal_name,
                journal_id: row.journal_id,
                metric_code: row.metric_code,
                metric_name: row.metric_name,
                metric_type: row.metric_type,
                value,
                year: row.year
            };
        });

        return {
            article_volume_trend: articleTrendRes,
            journal_metrics_comparison: journalMetrics
        };
    } catch (error) {
        logger.error('Lá»—i khi láº¥y dá»¯ liá»‡u phÃ¢n tÃ­ch cá»§a dá»± Ã¡n:', error);
        throw error;
    }
};



