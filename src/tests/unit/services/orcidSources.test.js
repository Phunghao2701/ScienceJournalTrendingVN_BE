import { after, afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";

import redis from "../../../config/redis.js";
import {
  CROSSREF_WORK_SELECT,
  fetchCrossrefWorksByOrcid,
  mapCrossrefWork,
} from "../../../services/crossrefApi.service.js";
import {
  fetchOpenAlexData,
  fetchOpenAlexWorksByIds,
  mapOpenAlexWork,
  OPENALEX_AUTHOR_SELECT,
  OPENALEX_WORK_SELECT,
} from "../../../services/openAlexApi.service.js";
import {
  fetchOrcidData,
  mapOrcidWorks,
} from "../../../services/orcidApi.service.js";
import {
  getOrcidAccessToken,
  resetOrcidTokenMemoryCacheForTests,
} from "../../../services/orcidToken.service.js";

const originalClientId = process.env.ORCID_CLIENT_ID;
const originalClientSecret = process.env.ORCID_CLIENT_SECRET;

describe("ORCID/Crossref/OpenAlex source adapters", () => {
  beforeEach(() => {
    process.env.ORCID_CLIENT_ID = "test-client";
    process.env.ORCID_CLIENT_SECRET = "test-secret";
    resetOrcidTokenMemoryCacheForTests();
  });

  afterEach(() => {
    resetOrcidTokenMemoryCacheForTests();
  });

  after(() => {
    process.env.ORCID_CLIENT_ID = originalClientId;
    process.env.ORCID_CLIENT_SECRET = originalClientSecret;
    redis.disconnect();
  });

  test("maps only ORCID journal articles", () => {
    const works = mapOrcidWorks({
      group: [
        {
          "work-summary": [
            {
              type: "journal-article",
              title: { title: { value: "Journal work" } },
              "journal-title": { value: "ORCID Journal" },
              "journal-issue": {
                volume: { value: "12" },
                issue: { value: "3" },
              },
              "publication-date": { year: { value: "2024" } },
              "external-ids": {
                "external-id": [
                  {
                    "external-id-type": "doi",
                    "external-id-value": "10.1000/TEST",
                  },
                  {
                    "external-id-type": "issn",
                    "external-id-value": "1234-567X",
                  },
                ],
              },
            },
          ],
        },
        {
          "work-summary": [
            {
              type: "conference-paper",
              title: { title: { value: "Conference work" } },
            },
          ],
        },
      ],
    });

    assert.equal(works.length, 1);
    assert.equal(works[0].doi, "10.1000/test");
    assert.equal(works[0].publication_year, 2024);
    assert.deepEqual(works[0].journal, {
      source_id: null,
      display_name: "ORCID Journal",
      issn_l: null,
      issns: ["1234567X"],
      type: null,
      is_open_access: null,
    });
    assert.equal(works[0].volume_number, "12");
    assert.equal(works[0].issue_number, "3");
  });

  test("maps publisher metadata from Crossref", () => {
    const work = mapCrossrefWork({
      type: "journal-article",
      DOI: "10.1000/TEST",
      title: ["<i>Publisher</i> title"],
      issued: { "date-parts": [[2025, 4, 2]] },
      author: [
        {
          given: "An",
          family: "Nguyen",
          ORCID: "https://orcid.org/0000-0002-1825-0097",
        },
      ],
      "is-referenced-by-count": 7,
      "references-count": 9,
      ISSN: ["1234-567X", "8765-4321"],
      "container-title": ["Journal of Examples"],
      volume: "8",
      issue: "2",
    });

    assert.equal(work.title, "Publisher title");
    assert.equal(work.publication_date, "2025-04-02");
    assert.equal(work.authors[0].author_position, "first");
    assert.equal(work.authors[0].institutions, undefined);
    assert.equal(work.reference_count, 9);
    assert.deepEqual(work.journal, {
      source_id: null,
      display_name: "Journal of Examples",
      issn_l: null,
      issns: ["1234567X", "87654321"],
      type: null,
      is_open_access: null,
    });
    assert.equal(work.volume_number, "8");
    assert.equal(work.issue_number, "2");
  });

  test("maps OpenAlex enrichment and reconstructs abstract", () => {
    const work = mapOpenAlexWork({
      id: "https://openalex.org/W123",
      type: "article",
      title: "OpenAlex title",
      abstract_inverted_index: { World: [1], Hello: [0] },
      cited_by_count: 12,
      biblio: { volume: "9", issue: "1" },
      authorships: [
        {
          author_position: "first",
          author: {
            id: "https://openalex.org/A123",
            display_name: "A. Author",
          },
          institutions: [
            {
              id: "https://openalex.org/I123",
              display_name: "Example University",
              country_code: "vn",
              type: "education",
            },
            {
              id: "I456",
              display_name: "Example Laboratory",
              country_code: "US",
              type: "facility",
            },
          ],
        },
      ],
      primary_location: {
        source: {
          id: "https://openalex.org/S123",
          display_name: "Open Journal",
          issn_l: "1234-567X",
          issn: ["1234-567X", "8765-4321"],
          type: "journal",
          is_oa: true,
        },
      },
    });

    assert.equal(work.abstract, "Hello World");
    assert.equal(work.openalex_id, "https://openalex.org/W123");
    assert.equal(
      work.authors[0].last_known_institution_id,
      "https://openalex.org/I123",
    );
    assert.deepEqual(work.authors[0].institutions, [
      {
        openalex_id: "https://openalex.org/I123",
        display_name: "Example University",
        country_code: "VN",
        type: "education",
      },
      {
        openalex_id: "https://openalex.org/I456",
        display_name: "Example Laboratory",
        country_code: "US",
        type: "facility",
      },
    ]);
    assert.deepEqual(work.journal, {
      source_id: "https://openalex.org/S123",
      display_name: "Open Journal",
      issn_l: "1234567X",
      issns: ["1234567X", "87654321"],
      type: "journal",
      is_open_access: true,
    });
    assert.equal(work.volume_number, "9");
    assert.equal(work.issue_number, "1");
  });

  test("calls Crossref with the approved ORCID journal filter and cursor", async () => {
    const calls = [];
    const httpClient = {
      get: async (path, config) => {
        calls.push({ path, config });
        return { data: { message: { items: [] } } };
      },
    };

    await fetchCrossrefWorksByOrcid("0000-0002-1825-0097", {
      httpClient,
    });

    assert.equal(calls[0].path, "/works");
    assert.equal(
      calls[0].config.params.filter,
      "orcid:0000-0002-1825-0097,type:journal-article",
    );
    assert.equal(calls[0].config.params.rows, 500);
    assert.equal(calls[0].config.params.cursor, "*");
    assert.equal(calls[0].config.params.order, "desc");
    assert.equal(calls[0].config.params.select, CROSSREF_WORK_SELECT);
    assert.deepEqual(
      new Set(calls[0].config.params.select.split(",")),
      new Set([
        "type",
        "DOI",
        "title",
        "abstract",
        "published-print",
        "published-online",
        "issued",
        "URL",
        "link",
        "page",
        "license",
        "is-referenced-by-count",
        "references-count",
        "author",
        "publisher",
        "container-title",
        "ISSN",
        "volume",
        "issue",
      ]),
    );
  });

  test("calls OpenAlex with the approved ORCID article filter and cursor", async () => {
    const calls = [];
    const httpClient = {
      get: async (path, config) => {
        calls.push({ path, config });
        return { data: { results: [] } };
      },
    };

    const result = await fetchOpenAlexData(
      "https://orcid.org/0000-0002-1825-0097",
      { httpClient },
    );
    const worksCall = calls.find((call) => call.path === "/works");
    const authorCall = calls.find((call) => call.path === "/authors");

    assert.equal(result.partial, false);
    assert.equal(
      worksCall.config.params.filter,
      "author.orcid:https://orcid.org/0000-0002-1825-0097,type:article",
    );
    assert.equal(worksCall.config.params.per_page, 100);
    assert.equal(worksCall.config.params.cursor, "*");
    assert.equal(worksCall.config.params.sort, "publication_date:desc");
    assert.equal(worksCall.config.params.select, OPENALEX_WORK_SELECT);
    assert.equal(authorCall.config.params.select, OPENALEX_AUTHOR_SELECT);
    assert.deepEqual(
      new Set(worksCall.config.params.select.split(",")),
      new Set([
        "id",
        "type",
        "doi",
        "title",
        "display_name",
        "abstract_inverted_index",
        "publication_year",
        "publication_date",
        "best_oa_location",
        "primary_location",
        "biblio",
        "open_access",
        "cited_by_count",
        "referenced_works",
        "authorships",
        "primary_topic",
        "topics",
        "keywords",
      ]),
    );
    assert.deepEqual(
      new Set(authorCall.config.params.select.split(",")),
      new Set([
        "id",
        "display_name",
        "works_count",
        "cited_by_count",
        "summary_stats",
        "last_known_institutions",
      ]),
    );
    assert.ok(
      worksCall.config.params.select
        .split(",")
        .every((field) => !field.includes(".")),
      "OpenAlex select only supports root fields",
    );
    assert.ok(
      authorCall.config.params.select
        .split(",")
        .every((field) => !field.includes(".")),
      "OpenAlex author select only supports root fields",
    );
  });

  test("reads every Crossref cursor page without limiting the total to 100", async () => {
    const calls = [];
    const pageLengths = [500, 500, 250];
    const httpClient = {
      get: async (_path, config) => {
        calls.push(config.params.cursor);
        const pageIndex = calls.length - 1;
        return {
          data: {
            message: {
              "total-results": 1250,
              "next-cursor": `cursor-${pageIndex + 1}`,
              items: Array.from(
                { length: pageLengths[pageIndex] },
                (_, index) => ({
                  type: "journal-article",
                  DOI: `10.1000/${pageIndex}-${index}`,
                  title: [`Crossref ${pageIndex}-${index}`],
                }),
              ),
            },
          },
        };
      },
    };

    const works = await fetchCrossrefWorksByOrcid(
      "0000-0002-1825-0097",
      { httpClient },
    );

    assert.equal(works.length, 1250);
    assert.deepEqual(calls, ["*", "cursor-1", "cursor-2"]);
    assert.equal(works.partial, false);
  });

  test("stops Crossref after the configured 100-work scan limit", async () => {
    const calls = [];
    const httpClient = {
      get: async (_path, config) => {
        calls.push(config.params);
        return {
          data: {
            message: {
              "total-results": 5000,
              "next-cursor": "cursor-2",
              items: Array.from({ length: 100 }, (_, index) => ({
                type: "journal-article",
                DOI: `10.1000/limited-${index}`,
                title: [`Limited Crossref ${index}`],
              })),
            },
          },
        };
      },
    };

    const works = await fetchCrossrefWorksByOrcid(
      "0000-0002-1825-0097",
      { httpClient, maxWorks: 100 },
    );

    assert.equal(works.length, 100);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].rows, 100);
  });

  test("reads every OpenAlex cursor page without limiting the total to 100", async () => {
    const workCursors = [];
    const pageLengths = [100, 100, 100, 50];
    const httpClient = {
      get: async (path, config) => {
        if (path === "/authors") {
          return { data: { results: [] } };
        }
        const pageIndex = workCursors.length;
        workCursors.push(config.params.cursor);
        return {
          data: {
            meta: {
              count: 350,
              next_cursor:
                pageIndex < pageLengths.length - 1
                  ? `cursor-${pageIndex + 1}`
                  : null,
            },
            results: Array.from(
              { length: pageLengths[pageIndex] },
              (_, index) => ({
                id: `https://openalex.org/W${pageIndex}${String(index).padStart(3, "0")}`,
                type: "article",
                title: `OpenAlex ${pageIndex}-${index}`,
              }),
            ),
          },
        };
      },
    };

    const result = await fetchOpenAlexData(
      "https://orcid.org/0000-0002-1825-0097",
      { httpClient },
    );

    assert.equal(result.works.length, 350);
    assert.deepEqual(workCursors, ["*", "cursor-1", "cursor-2", "cursor-3"]);
    assert.equal(result.partial, false);
  });

  test("stops OpenAlex after the configured 100-work scan limit", async () => {
    const workCursors = [];
    const httpClient = {
      get: async (path, config) => {
        if (path === "/authors") return { data: { results: [] } };
        workCursors.push(config.params.cursor);
        return {
          data: {
            meta: { count: 5000, next_cursor: "cursor-2" },
            results: Array.from({ length: 100 }, (_, index) => ({
              id: `https://openalex.org/W9${String(index).padStart(3, "0")}`,
              type: "article",
              title: `Limited OpenAlex ${index}`,
            })),
          },
        };
      },
    };

    const result = await fetchOpenAlexData(
      "https://orcid.org/0000-0002-1825-0097",
      { httpClient, maxWorks: 100 },
    );

    assert.equal(result.works.length, 100);
    assert.deepEqual(workCursors, ["*"]);
  });

  test("keeps fetched Crossref pages when a later cursor page fails", async () => {
    let callCount = 0;
    const httpClient = {
      get: async () => {
        callCount += 1;
        if (callCount === 2) {
          throw { response: { status: 400 } };
        }
        return {
          data: {
            message: {
              "total-results": 4,
              "next-cursor": "cursor-1",
              items: [
                { type: "journal-article", DOI: "10.1000/1", title: ["One"] },
                { type: "journal-article", DOI: "10.1000/2", title: ["Two"] },
              ],
            },
          },
        };
      },
    };

    const works = await fetchCrossrefWorksByOrcid(
      "0000-0002-1825-0097",
      { httpClient, pageSize: 2 },
    );

    assert.equal(works.length, 2);
    assert.equal(works.partial, true);
    assert.equal(works.paginationError, 400);
  });

  test("keeps fetched OpenAlex pages when a later cursor page fails", async () => {
    let workCallCount = 0;
    const httpClient = {
      get: async (path) => {
        if (path === "/authors") return { data: { results: [] } };
        workCallCount += 1;
        if (workCallCount === 2) {
          throw { response: { status: 400 } };
        }
        return {
          data: {
            meta: { count: 4, next_cursor: "cursor-1" },
            results: [
              { id: "https://openalex.org/W1", type: "article", title: "One" },
              { id: "https://openalex.org/W2", type: "article", title: "Two" },
            ],
          },
        };
      },
    };

    const result = await fetchOpenAlexData(
      "https://orcid.org/0000-0002-1825-0097",
      { httpClient, pageSize: 2 },
    );

    assert.equal(result.works.length, 2);
    assert.equal(result.partial, true);
    assert.equal(result.error, 400);
  });

  test("fetches reference works in bounded OpenAlex ID batches", async () => {
    const calls = [];
    const httpClient = {
      get: async (_path, config) => {
        calls.push(config);
        const ids = config.params.filter
          .replace("openalex_id:", "")
          .split("|");
        return {
          data: {
            results: ids.map((id) => ({
              id: `https://openalex.org/${id}`,
            })),
          },
        };
      },
    };
    const ids = Array.from({ length: 205 }, (_, index) => `W${index + 1}`);
    const result = await fetchOpenAlexWorksByIds(ids, { httpClient });

    assert.equal(calls.length, 3);
    assert.ok(
      calls.every(
        (call) =>
          call.params["per-page"] <= 100 &&
          call.timeout === 8000,
      ),
    );
    assert.equal(result.works.length, 205);
    assert.deepEqual(result.failed_ids, []);
  });

  test("refreshes an ORCID token once after 401 and retries the request", async () => {
    const callsByPath = new Map();
    const tokenCalls = [];
    let invalidationCount = 0;
    const httpClient = {
      get: async (path, config) => {
        const count = (callsByPath.get(path) || 0) + 1;
        callsByPath.set(path, count);
        if (count === 1) {
          throw { response: { status: 401 } };
        }
        if (path.endsWith("/person")) {
          return {
            data: {
              name: {
                "given-names": { value: "Example" },
                "family-name": { value: "Author" },
              },
            },
          };
        }
        return { data: { group: [] } };
      },
    };
    const tokenProvider = async (options = {}) => {
      tokenCalls.push(options);
      return options.forceRefresh ? "fresh-token" : "stale-token";
    };

    const result = await fetchOrcidData("0000-0002-1825-0097", {
      httpClient,
      tokenProvider,
      tokenInvalidator: async () => {
        invalidationCount += 1;
      },
    });

    assert.equal(result.partial, false);
    assert.equal(result.profile.display_name, "Example Author");
    assert.equal(callsByPath.get("/0000-0002-1825-0097/person"), 2);
    assert.equal(callsByPath.get("/0000-0002-1825-0097/works"), 2);
    assert.equal(invalidationCount, 2);
    assert.equal(
      tokenCalls.filter((options) => options.forceRefresh).length,
      2,
    );
  });

  test("deduplicates concurrent token refreshes and uses memory fallback", async () => {
    let postCount = 0;
    const httpClient = {
      post: async () => {
        postCount += 1;
        await new Promise((resolve) => setImmediate(resolve));
        return { data: { access_token: "token-1", expires_in: 3600 } };
      },
    };
    const redisClient = {
      get: async () => null,
      set: async () => {
        throw new Error("Redis unavailable");
      },
      del: async () => {},
    };

    const tokens = await Promise.all([
      getOrcidAccessToken({ httpClient, redisClient }),
      getOrcidAccessToken({ httpClient, redisClient }),
    ]);
    const cached = await getOrcidAccessToken({ httpClient, redisClient });

    assert.deepEqual(tokens, ["token-1", "token-1"]);
    assert.equal(cached, "token-1");
    assert.equal(postCount, 1);
  });

  test("uses a token already cached in Redis", async () => {
    const redisClient = {
      get: async () => "redis-token",
      set: async () => assert.fail("must not write on cache hit"),
      del: async () => {},
    };
    const httpClient = {
      post: async () => assert.fail("must not request a token on cache hit"),
    };

    const token = await getOrcidAccessToken({ httpClient, redisClient });
    assert.equal(token, "redis-token");
  });
});
