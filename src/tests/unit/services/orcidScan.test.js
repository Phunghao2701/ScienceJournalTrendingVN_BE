import { after, describe, test } from "node:test";
import assert from "node:assert/strict";

import pool from "../../../config/database.js";
import redis from "../../../config/redis.js";
import {
  enrichCrossrefByDoi,
  mergeArticleCandidates,
  scanAuthorByOrcid,
} from "../../../modules/author/services/orcidScan.service.js";

const crossrefArticle = (overrides = {}) => ({
  source: "crossref",
  source_type: "journal-article",
  doi: "10.1000/example",
  openalex_id: null,
  title: "Crossref title",
  publication_year: 2025,
  publication_date: "2025-01-01",
  authors: [],
  topics: [],
  keywords: [],
  ...overrides,
});

describe("ORCID scan orchestration", () => {
  after(async () => {
    redis.disconnect();
    await pool.end();
  });

  test("merges source metadata, linked author identities and filters invalid works", () => {
    const result = mergeArticleCandidates([
      crossrefArticle({
        authors: [
          {
            orcid: "0000-0002-1825-0097",
            display_name: "Author name",
            institutions: [{
              openalex_id: "I999",
              display_name: "Must be ignored from Crossref",
            }],
          },
        ],
        journal: {
          display_name: "Journal of Examples",
          issns: ["1234-567X"],
        },
      }),
      {
        source: "openalex",
        source_type: "article",
        doi: "https://doi.org/10.1000/EXAMPLE",
        openalex_id: "W123",
        title: "OpenAlex title",
        citation_count: 10,
        authors: [
          {
            orcid: "0000-0002-1825-0097",
            openalex_id: "A123",
            display_name: "OpenAlex author",
            institutions: [
              {
                openalex_id: "I10",
                display_name: "Institution 10",
                country_code: "vn",
              },
              {
                openalex_id: "https://openalex.org/I20",
                display_name: "Institution 20",
                type: "facility",
              },
            ],
          },
          {
            openalex_id: "A123",
            display_name: "Duplicate identity",
          },
        ],
        topics: [],
        keywords: [],
        journal: {
          source_id: "https://openalex.org/S123",
          display_name: "Journal of Examples",
          issn_l: "1234-567X",
          issns: ["1234-567X", "8765-4321"],
          type: "journal",
          is_open_access: true,
        },
        volume_number: "11",
        issue_number: "4",
      },
      {
        source: "orcid",
        source_type: "conference-paper",
        doi: "10.1000/conference",
        title: "Conference",
      },
      {
        source: "orcid",
        source_type: "journal-article",
        title: "No stable identifier",
      },
    ]);

    assert.equal(result.articles.length, 1);
    assert.equal(result.articles[0].title, "Crossref title");
    assert.equal(result.articles[0].citation_count, 10);
    assert.equal(result.articles[0].authors.length, 1);
    assert.equal(
      result.articles[0].authors[0].openalex_id,
      "https://openalex.org/A123",
    );
    assert.deepEqual(
      result.articles[0].authors[0].institutions.map(
        (institution) => institution.openalex_id,
      ),
      [
        "https://openalex.org/I10",
        "https://openalex.org/I20",
      ],
    );
    assert.deepEqual(result.articles[0].journal, {
      source_id: "https://openalex.org/S123",
      display_name: "Journal of Examples",
      issn_l: "1234567X",
      issns: ["1234567X", "87654321"],
      type: "journal",
      is_open_access: true,
    });
    assert.equal(result.articles[0].volume_number, "11");
    assert.equal(result.articles[0].issue_number, "4");
    assert.equal(result.stats.skipped_invalid_type, 1);
    assert.equal(result.stats.skipped_missing_identifier, 1);
  });

  test("keeps every journal article without a total-result cap", () => {
    const candidates = Array.from({ length: 105 }, (_, index) =>
      crossrefArticle({
        doi: `10.1000/${index}`,
        title: `Article ${index}`,
        publication_year: 2000 + index,
        publication_date: `${2000 + index}-01-01`,
      }),
    );

    const result = mergeArticleCandidates(candidates);
    assert.equal(result.discovered, 105);
    assert.equal(result.articles.length, 105);
    assert.equal(result.articles[0].publication_year, 2104);
  });

  test("limits one ORCID scan to the 100 newest journal articles", async () => {
    const candidates = Array.from({ length: 150 }, (_, index) =>
      crossrefArticle({
        doi: `10.1000/scan-limit-${index}`,
        title: `Article ${index}`,
        publication_year: 2000 + index,
        publication_date: `${2000 + index}-01-01`,
      }),
    );
    const sourceOptions = {};
    let persistedInput;

    const result = await scanAuthorByOrcid("0000-0002-1825-0097", {
      fetchOrcid: async (_orcid, options) => {
        sourceOptions.orcid = options;
        return {
          profile: {
            orcid: "https://orcid.org/0000-0002-1825-0097",
            display_name: "Limited Author",
          },
          works: candidates,
        };
      },
      fetchCrossref: async (_orcid, options) => {
        sourceOptions.crossref = options;
        return [];
      },
      fetchOpenAlex: async (_orcid, options) => {
        sourceOptions.openalex = options;
        return { author: null, works: [] };
      },
      fetchCrossrefByDoi: async () => null,
      persist: async (input) => {
        persistedInput = input;
        return {
          author: { author_id: "1", ...input.targetAuthor },
          articles: [],
          article_total: input.articles.length,
          summary: {
            created: input.articles.length,
            filled_missing: 0,
            already_existed: 0,
            skipped_deleted: 0,
            failed_to_persist: 0,
          },
        };
      },
    });

    assert.equal(sourceOptions.orcid.maxWorks, 100);
    assert.equal(sourceOptions.crossref.maxWorks, 100);
    assert.equal(sourceOptions.openalex.maxWorks, 100);
    assert.equal(persistedInput.articles.length, 100);
    assert.equal(persistedInput.articles[0].publication_year, 2149);
    assert.equal(result.summary.discovered, 100);
  });

  test("persists partial source success and returns DB records", async () => {
    let persistedInput = null;
    const storedArticle = { article_id: "10", title: "Stored title" };
    const result = await scanAuthorByOrcid("0000-0002-1825-0097", {
      fetchOrcid: async () => {
        throw Object.assign(new Error("ORCID unavailable"), {
          code: "ECONNABORTED",
        });
      },
      fetchCrossref: async () => [crossrefArticle()],
      fetchOpenAlex: async () => {
        throw Object.assign(new Error("OpenAlex unavailable"), {
          code: "ECONNABORTED",
        });
      },
      fetchCrossrefByDoi: async () =>
        assert.fail("Crossref list already supplied metadata"),
      persist: async (input) => {
        persistedInput = input;
        return {
          author: { author_id: "1", ...input.targetAuthor },
          articles: [storedArticle],
          summary: {
            created: 1,
            filled_missing: 0,
            already_existed: 0,
            skipped_deleted: 0,
            failed_to_persist: 0,
          },
        };
      },
    });

    assert.equal(result.partial, true);
    assert.deepEqual(result.articles, [storedArticle]);
    assert.deepEqual(result.pagination, {
      page: 1,
      limit: 20,
      total: 1,
      total_pages: 1,
      has_next: false,
      next_url: null,
    });
    assert.equal(result.source_status.crossref.status, "success");
    assert.equal(result.source_status.orcid.status, "failed");
    assert.equal(persistedInput.articles.length, 1);
    assert.equal(
      persistedInput.articles[0].authors[0].orcid,
      "https://orcid.org/0000-0002-1825-0097",
    );
  });

  test("limits DOI enrichment to 10 targets with concurrency 3", async () => {
    let active = 0;
    let maxActive = 0;
    let callCount = 0;
    const articles = Array.from({ length: 15 }, (_, index) => ({
      doi: `10.1000/${index}`,
      source_presence: ["orcid"],
    }));

    const result = await enrichCrossrefByDoi(articles, {
      concurrency: 3,
      budgetMs: 1000,
      fetchWorkByDoi: async (doi) => {
        callCount += 1;
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setImmediate(resolve));
        active -= 1;
        return crossrefArticle({ doi });
      },
    });

    assert.equal(callCount, 10);
    assert.equal(maxActive, 3);
    assert.equal(result.works.length, 10);
    assert.equal(result.failed, 0);
  });

  test("stops DOI enrichment when its total budget expires", async () => {
    const startedAt = performance.now();
    const result = await enrichCrossrefByDoi(
      Array.from({ length: 10 }, (_, index) => ({
        doi: `10.1000/slow-${index}`,
        source_presence: ["orcid"],
      })),
      {
        concurrency: 3,
        budgetMs: 20,
        fetchWorkByDoi: async (_doi, { signal }) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener(
              "abort",
              () =>
                reject(
                  Object.assign(new Error("aborted"), {
                    code: "ABORT_ERR",
                  }),
                ),
              { once: true },
            );
          }),
      },
    );

    assert.ok(performance.now() - startedAt < 250);
    assert.equal(result.works.length, 0);
    assert.equal(result.failed, 10);
  });

  test("logs structured timings and returns only page one of scan articles", async () => {
    const logs = [];
    const storedArticles = Array.from({ length: 25 }, (_, index) => ({
      article_id: String(index + 1),
      title: `Stored ${index}`,
    }));
    const result = await scanAuthorByOrcid("0000-0002-1825-0097", {
      fetchOrcid: async () => ({ profile: {}, works: [] }),
      fetchCrossref: async () => [crossrefArticle()],
      fetchOpenAlex: async () => ({ profile: {}, works: [] }),
      fetchCrossrefByDoi: async () =>
        assert.fail("Crossref list already supplied metadata"),
      persist: async () => ({
        author: { author_id: "7" },
        articles: storedArticles,
        article_total: 25,
        summary: {
          created: 1,
          filled_missing: 0,
          already_existed: 0,
          failed_to_persist: 0,
        },
      }),
      timingLogger: {
        info: (message, fields) => logs.push({ message, fields }),
      },
    });

    assert.equal(result.articles.length, 20);
    assert.deepEqual(result.pagination, {
      page: 1,
      limit: 20,
      total: 25,
      total_pages: 2,
      has_next: true,
      next_url: "/api/v1/author/7/articles?page=2&limit=20",
    });
    assert.equal(result.summary.created, 1);
    assert.deepEqual(
      logs.map(({ fields }) => fields.stage),
      [
        "external_sources",
        "crossref_doi_enrichment",
        "merge",
        "persist",
        "total",
      ],
    );
    assert.ok(
      logs.every(
        ({ fields }) =>
          fields.event === "orcid_scan_stage_timing" &&
          Number.isFinite(fields.duration_ms),
      ),
    );
    assert.doesNotMatch(JSON.stringify(logs), /token|secret|api_key/i);
  });

  test("fails with 502 only when all three sources fail", async () => {
    const failure = async () => {
      throw new Error("unavailable");
    };

    await assert.rejects(
      scanAuthorByOrcid("0000-0002-1825-0097", {
        fetchOrcid: failure,
        fetchCrossref: failure,
        fetchOpenAlex: failure,
        persist: async () => assert.fail("must not persist"),
      }),
      {
        statusCode: 502,
        code: "EXTERNAL_SOURCES_UNAVAILABLE",
      },
    );
  });

  test("rejects invalid ORCID when the service is called directly", async () => {
    await assert.rejects(scanAuthorByOrcid("invalid"), {
      statusCode: 400,
      code: "ORCID_INVALID",
    });
  });
});
