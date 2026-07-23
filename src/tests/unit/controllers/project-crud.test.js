import test, { afterEach, describe, mock } from "node:test";
import assert from "node:assert/strict";
import {
  createProject,
  deleteProject,
  getProjectById,
  getProjects,
  projectAuditRef,
  projectServiceRef,
  updateProject,
} from "../../../controllers/project.controller.js";

const createResponse = () => ({
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
});

describe("Project CRUD controller", () => {
  afterEach(() => mock.restoreAll());

  test("lists only projects returned for the authenticated user", async () => {
    const projects = [{ project_id: "11", title: "AI trends" }];
    const getUserProjects = mock.method(
      projectServiceRef,
      "getUserProjects",
      async () => projects,
    );
    const request = { user: { user_id: "user-1" } };
    const response = createResponse();

    await getProjects(request, response);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.data, projects);
    assert.deepEqual(getUserProjects.mock.calls[0].arguments, ["user-1"]);
  });

  test("returns 404 when reading a project not owned by the user", async () => {
    mock.method(projectServiceRef, "getProjectById", async () => null);
    const request = {
      params: { id: "11" },
      user: { user_id: "user-2" },
    };
    const response = createResponse();

    await getProjectById(request, response);

    assert.equal(response.statusCode, 404);
    assert.equal(response.body.code, "PROJECT_NOT_FOUND_OR_ACCESS_DENIED");
  });

  test("creates a project with the FE subject_area_id contract", async () => {
    const created = {
      project_id: "12",
      title: "AI trends",
      subject_area: 4,
    };
    const create = mock.method(
      projectServiceRef,
      "createProject",
      async () => created,
    );
    mock.method(projectAuditRef, "createLog", () => {});
    const request = {
      body: {
        title: " AI trends ",
        subject_area_id: 4,
        subject_category_ids: [7],
        journal_ids: [9],
      },
      user: { user_id: "user-1", role: "USER" },
      ip: "127.0.0.1",
    };
    const response = createResponse();

    await createProject(request, response);

    assert.equal(response.statusCode, 201);
    assert.deepEqual(create.mock.calls[0].arguments[0], {
      userId: "user-1",
      title: "AI trends",
      subject_area: 4,
      subject_category_ids: [7],
      journal_ids: [9],
    });
  });

  test("updates only a project owned by the authenticated user", async () => {
    const updated = { project_id: "11", title: "Updated project" };
    const update = mock.method(
      projectServiceRef,
      "updateProject",
      async () => updated,
    );
    mock.method(projectAuditRef, "createLog", () => {});
    const request = {
      params: { id: "11" },
      body: {
        title: " Updated project ",
        subject_area_id: 5,
        subject_category_ids: [],
        journal_ids: [10],
      },
      user: { user_id: "user-1", role: "USER" },
      ip: "127.0.0.1",
    };
    const response = createResponse();

    await updateProject(request, response);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(update.mock.calls[0].arguments, [
      "11",
      "user-1",
      {
        title: "Updated project",
        subject_area: 5,
        subject_category_ids: [],
        journal_ids: [10],
      },
    ]);
  });

  test("returns 404 when deleting a project not owned by the user", async () => {
    mock.method(projectServiceRef, "deleteProject", async () => false);
    const request = {
      params: { id: "11" },
      user: { user_id: "user-2", role: "USER" },
      ip: "127.0.0.1",
    };
    const response = createResponse();

    await deleteProject(request, response);

    assert.equal(response.statusCode, 404);
    assert.equal(response.body.code, "PROJECT_NOT_FOUND_OR_ACCESS_DENIED");
  });
});
