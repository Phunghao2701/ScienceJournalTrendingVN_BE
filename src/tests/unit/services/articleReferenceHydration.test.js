import { after, describe, test } from "node:test";
import assert from "node:assert/strict";

import pool from "../../../config/database.js";
import { hydrateArticleReferences } from "../../../modules/article/services/articleReferenceHydration.service.js";

after(async () => {
  await pool.end();
});

const createDatabase = ({
  references = [],
  localArticles = [],
  storedReferences = [],
  deleted = false,
} = {}) => {
  const stored = new Map(
    storedReferences.map((row) => [row.reference_key, { ...row }]),
  );
  let connectCount = 0;
  const databasePool = {
    $queryRawUnsafe: async (sql) => {
      const compact = sql.replace(/\s+/g, " ").trim();
      if (
        compact.includes('SELECT article_id, "references", is_deleted')
      ) {
        return [{
            article_id: "1",
            references,
            is_deleted: deleted,
        }];
      }
      if (compact.includes('FROM "Article_Reference"')) {
        return [...stored.values()];
      }
      if (
        compact.includes('FROM "Article"') &&
        compact.includes("openalex_id")
      ) {
        return localArticles;
      }
      return [];
    },
    $transaction: async (callback) => {
      connectCount += 1;
      const tx = {
        $executeRawUnsafe: async (query, ...values) => tx.$queryRawUnsafe(query, ...values),
        $queryRawUnsafe: async (query, ...values) => {
          let sql = query;
          if (typeof query === "object") {
            sql = query.text;
            values = query.values;
          }
          const compact = sql.replace(/\s+/g, " ").trim();
          if (compact === "BEGIN" || compact === "COMMIT") {
            return [];
          }
          if (compact === "ROLLBACK") return [];
          if (compact.includes("pg_advisory_xact_lock")) {
            return [];
          }
          if (
            compact.includes('FROM "Article"') &&
            compact.includes("FOR UPDATE")
          ) {
            return deleted
              ? []
              : [{ article_id: "1" }];
          }
          if (
            compact.includes('SELECT reference_key') &&
            compact.includes('FROM "Article_Reference"')
          ) {
            return [...stored.keys()].map((reference_key) => ({
                reference_key,
            }));
          }
          if (compact.startsWith("WITH reference_input AS MATERIALIZED")) {
            for (const record of JSON.parse(values[1])) {
              const current = stored.get(record.reference_key) || {};
              const merged = { ...current };
              for (const [field, value] of Object.entries(record)) {
                if (merged[field] == null && value != null) {
                  merged[field] = value;
                }
              }
              stored.set(record.reference_key, merged);
            }
            return [];
          }
          return [];
        },
      };
      return callback(tx);
    },
  };
  return {
    databasePool,
    stored,
    get connectCount() {
      return connectCount;
    },
  };
};

describe("lazy Article reference hydration", () => {
  test("uses local Articles first and batches only missing OpenAlex metadata", async () => {
    const db = createDatabase({
      references: ["W1", "https://openalex.org/W2", "W1"],
      localArticles: [{
        article_id: "22",
        openalex_id: "https://openalex.org/W1",
        doi: "10.1/local",
        title: "Local title",
        publication_year: 2020,
        citation_count: 4,
      }],
    });
    const calls = [];
    const result = await hydrateArticleReferences("1", {
      databasePool: db.databasePool,
      fetchWorks: async (ids) => {
        calls.push(ids);
        return {
          works: [{
            id: "W2",
            doi: "https://doi.org/10.1/external",
            title: "External title",
            publication_year: 2021,
            cited_by_count: 7,
            authorships: [],
          }],
          failed_ids: [],
        };
      },
    });

    assert.deepEqual(calls, [["https://openalex.org/W2"]]);
    assert.deepEqual(result.summary, {
      requested: 2,
      resolved: 2,
      inserted: 2,
      already_available: 0,
      failed: 0,
    });
    assert.equal(
      db.stored.get("https://openalex.org/W1").referenced_article_id,
      "22",
    );
    assert.equal(
      db.stored.get("https://openalex.org/W2").title,
      "External title",
    );
  });

  test("is idempotent and does not call OpenAlex again for hydrated rows", async () => {
    const db = createDatabase({
      references: ["W1"],
      storedReferences: [{
        reference_key: "https://openalex.org/W1",
        openalex_work_id: "https://openalex.org/W1",
        title: "Curated title",
      }],
    });
    let calls = 0;
    const result = await hydrateArticleReferences("1", {
      databasePool: db.databasePool,
      fetchWorks: async () => {
        calls += 1;
        return { works: [], failed_ids: [] };
      },
    });

    assert.equal(calls, 0);
    assert.equal(result.summary.inserted, 0);
    assert.equal(result.summary.already_available, 1);
    assert.equal(
      db.stored.get("https://openalex.org/W1").title,
      "Curated title",
    );
  });

  test("fills null reference metadata without overwriting curated values", async () => {
    const db = createDatabase({
      references: ["W1"],
      storedReferences: [{
        reference_key: "https://openalex.org/W1",
        openalex_work_id: "https://openalex.org/W1",
        doi: "10.1/curated",
        title: null,
      }],
    });
    const result = await hydrateArticleReferences("1", {
      databasePool: db.databasePool,
      fetchWorks: async () => ({
        works: [{
          id: "W1",
          doi: "10.1/provider",
          title: "Provider title",
          authorships: [],
        }],
        failed_ids: [],
      }),
    });

    assert.equal(result.summary.inserted, 0);
    assert.equal(
      db.stored.get("https://openalex.org/W1").doi,
      "10.1/curated",
    );
    assert.equal(
      db.stored.get("https://openalex.org/W1").title,
      "Provider title",
    );
  });

  test("persists local success and reports provider partial failure", async () => {
    const db = createDatabase({
      references: ["W1", "W2"],
      localArticles: [{
        article_id: "31",
        openalex_id: "W1",
        title: "Local",
      }],
    });
    const result = await hydrateArticleReferences("1", {
      databasePool: db.databasePool,
      fetchWorks: async () => ({
        works: [],
        failed_ids: ["https://openalex.org/W2"],
      }),
    });

    assert.equal(result.partial, true);
    assert.equal(result.summary.resolved, 1);
    assert.equal(result.summary.failed, 1);
    assert.equal(result.summary.inserted, 1);
    assert.equal(db.stored.has("https://openalex.org/W2"), false);
  });

  test("does not insert a placeholder when OpenAlex omits a requested ID", async () => {
    const db = createDatabase({ references: ["W1", "W2"] });
    const result = await hydrateArticleReferences("1", {
      databasePool: db.databasePool,
      fetchWorks: async () => ({
        works: [{
          id: "W1",
          title: "Only returned work",
          authorships: [],
        }],
        failed_ids: [],
      }),
    });

    assert.equal(result.partial, true);
    assert.equal(result.summary.resolved, 1);
    assert.equal(result.summary.inserted, 1);
    assert.equal(result.summary.failed, 1);
    assert.equal(db.stored.has("https://openalex.org/W2"), false);
  });

  test("returns 502 when provider fails completely and nothing is locally resolvable", async () => {
    const db = createDatabase({ references: ["W1"] });
    await assert.rejects(
      () =>
        hydrateArticleReferences("1", {
          databasePool: db.databasePool,
          fetchWorks: async () => ({
            works: [],
            failed_ids: ["https://openalex.org/W1"],
          }),
        }),
      (error) =>
        error.statusCode === 502 &&
        error.code === "REFERENCE_PROVIDER_UNAVAILABLE",
    );
    assert.equal(db.connectCount, 0);
  });

  test("returns a successful no-reference summary without network or writes", async () => {
    const db = createDatabase({ references: [] });
    let fetchCalls = 0;
    const result = await hydrateArticleReferences("1", {
      databasePool: db.databasePool,
      fetchWorks: async () => {
        fetchCalls += 1;
      },
    });
    assert.equal(fetchCalls, 0);
    assert.equal(db.connectCount, 0);
    assert.equal(result.noReferences, true);
    assert.equal(result.summary.requested, 0);
  });
});
