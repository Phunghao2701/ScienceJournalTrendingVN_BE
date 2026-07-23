import test, { describe, mock } from "node:test";
import assert from "node:assert/strict";
import {
  getTrendingKeywords,
  keywordServiceRef,
} from "../../../controllers/keyword.controller.js";

const createResponse = () => {
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return response;
};

describe("Project keyword trending authorization", () => {
  test("returns 400 for an invalid project id", async () => {
    const request = {
      params: { id: "invalid" },
      query: {},
      user: { user_id: "user-1" },
    };
    const response = createResponse();

    await getTrendingKeywords(request, response);

    assert.equal(response.statusCode, 400);
    assert.equal(response.body.success, false);
  });

  test("returns 404 when the project is not owned by the current user", async () => {
    mock.method(
      keywordServiceRef,
      "checkProjectOwnership",
      async () => false,
    );
    const request = {
      params: { id: "11" },
      query: {},
      user: { user_id: "user-2" },
    };
    const response = createResponse();

    await getTrendingKeywords(request, response);

    assert.equal(response.statusCode, 404);
    assert.equal(response.body.code, "PROJECT_NOT_FOUND");
    mock.restoreAll();
  });

  test("returns nested trending keyword data for the project owner", async () => {
    mock.method(
      keywordServiceRef,
      "checkProjectOwnership",
      async () => true,
    );
    mock.method(
      keywordServiceRef,
      "getTrendingKeywords",
      async () => ({
        total: 1,
        sort_by: "count",
        keywords: [{ id: "5", keyword: "Machine learning", count: 3 }],
      }),
    );
    const request = {
      params: { id: "11" },
      query: { limit: "20" },
      user: { user_id: "user-1" },
    };
    const response = createResponse();

    await getTrendingKeywords(request, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.keywords[0].keyword, "Machine learning");
    mock.restoreAll();
  });
});
