import { test, describe, mock, afterEach } from "node:test";
import assert from "node:assert";
import pool from "../../../config/database.js";

test.after(async () => {
  await pool.end();
});

import {
  createVolume,
  getVolumes,
  getVolumeById,
  updateVolume,
  deleteVolume,
  restoreVolume,
  volumeServiceRef
} from "../../../controllers/volume.controller.js";
import logger from "../../../utils/logger.js";

describe("Volume Controller Unit Test Suite", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  const createMockResponse = () => {
    const res = {};
    res.status = (statusCode) => {
      res.statusCode = statusCode;
      return res;
    };
    res.json = (jsonData) => {
      res.body = jsonData;
      return res;
    };
    return res;
  };

  test("createVolume: Thành công tạo mới một volume", async () => {
    const mockVolume = {
      volume_id: "10",
      journal_id: "1",
      volume_number: 12,
      publication_year: 2025,
      is_deleted: false
    };

    const mockCreate = mock.method(volumeServiceRef, "createVolume", async () => mockVolume);
    mock.method(logger, "error", () => {});

    const req = {
      body: {
        journal_id: "1",
        volume_number: 12,
        publication_year: 2025
      }
    };
    const res = createMockResponse();

    await createVolume(req, res);

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.message, "Tạo Volume thành công");
    assert.deepStrictEqual(res.body.data, mockVolume);
    assert.deepStrictEqual(mockCreate.mock.calls[0].arguments, [
      { journal_id: "1", volume_number: 12, publication_year: 2025 }
    ]);
  });

  test("getVolumes: Thành công lấy danh sách volume với phân trang", async () => {
    const mockList = {
      items: [
        {
          volume_id: "1",
          journal_id: "1",
          volume_number: 227,
          publication_year: 1970,
          is_deleted: false
        }
      ],
      total: 1
    };

    const mockGet = mock.method(volumeServiceRef, "getVolumes", async () => mockList);
    mock.method(logger, "error", () => {});

    const req = {
      query: {
        page: "1",
        limit: "10",
        journal_id: "1"
      }
    };
    const res = createMockResponse();

    await getVolumes(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.message, "Lấy danh sách volume thành công");
    assert.deepStrictEqual(res.body.data.items, mockList.items);
    assert.strictEqual(res.body.data.pagination.total, 1);
    assert.deepStrictEqual(mockGet.mock.calls[0].arguments, [
      {
        page: "1",
        limit: "10",
        search: undefined,
        journal_id: "1",
        publication_year: undefined,
        sort_by: undefined,
        sort_order: undefined
      }
    ]);
  });

  test("getVolumeById: Thành công lấy chi tiết volume", async () => {
    const mockVolume = {
      volume_id: "1",
      journal_id: "1",
      volume_number: 227,
      publication_year: 1970,
      is_deleted: false
    };

    const mockGetById = mock.method(volumeServiceRef, "getVolumeById", async () => mockVolume);
    mock.method(logger, "error", () => {});

    const req = { params: { id: "1" } };
    const res = createMockResponse();

    await getVolumeById(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.deepStrictEqual(res.body.data, mockVolume);
    assert.deepStrictEqual(mockGetById.mock.calls[0].arguments, ["1"]);
  });

  test("getVolumeById: Thất bại khi không tìm thấy volume", async () => {
    mock.method(volumeServiceRef, "getVolumeById", async () => null);
    mock.method(logger, "error", () => {});

    const req = { params: { id: "999" } };
    const res = createMockResponse();

    await getVolumeById(req, res);

    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.code, "VOLUME_NOT_FOUND");
  });

  test("updateVolume: Thành công cập nhật thông tin volume", async () => {
    const mockVolume = {
      volume_id: "1",
      journal_id: "1",
      volume_number: 15,
      publication_year: 2026,
      is_deleted: false
    };

    const mockUpdate = mock.method(volumeServiceRef, "updateVolume", async () => mockVolume);
    mock.method(logger, "error", () => {});

    const req = {
      params: { id: "1" },
      body: {
        volume_number: 15,
        publication_year: 2026
      }
    };
    const res = createMockResponse();

    await updateVolume(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.deepStrictEqual(res.body.data, mockVolume);
    assert.deepStrictEqual(mockUpdate.mock.calls[0].arguments, [
      "1",
      { volume_number: 15, publication_year: 2026 }
    ]);
  });

  test("deleteVolume: Thất bại khi volume không tồn tại", async () => {
    mock.method(volumeServiceRef, "volumeExist", async () => false);
    mock.method(logger, "error", () => {});

    const req = { params: { id: "999" } };
    const res = createMockResponse();

    await deleteVolume(req, res);

    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.code, "VOLUME_NOT_FOUND");
  });

  test("deleteVolume: Thất bại khi volume đã bị xóa mềm trước đó", async () => {
    mock.method(volumeServiceRef, "volumeExist", async () => true);
    mock.method(volumeServiceRef, "volumeIsDeleted", async () => true);
    mock.method(logger, "error", () => {});

    const req = { params: { id: "1" } };
    const res = createMockResponse();

    await deleteVolume(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.code, "VOLUME_ALREADY_DELETED");
    assert.strictEqual(res.body.message, "Không delete volume đã bị delete");
  });

  test("deleteVolume: Thành công xóa mềm volume", async () => {
    const mockVolume = {
      volume_id: "1",
      journal_id: "1",
      volume_number: 227,
      publication_year: 1970,
      is_deleted: true
    };

    mock.method(volumeServiceRef, "volumeExist", async () => true);
    mock.method(volumeServiceRef, "volumeIsDeleted", async () => false);
    mock.method(volumeServiceRef, "deleteVolume", async () => mockVolume);
    mock.method(logger, "error", () => {});

    const req = { params: { id: "1" } };
    const res = createMockResponse();

    await deleteVolume(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.message, "Xóa Volume thành công");
    assert.deepStrictEqual(res.body.data, mockVolume);
  });

  test("restoreVolume: Thất bại khi volume không tồn tại", async () => {
    mock.method(volumeServiceRef, "volumeExist", async () => false);
    mock.method(logger, "error", () => {});

    const req = { params: { id: "999" } };
    const res = createMockResponse();

    await restoreVolume(req, res);

    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.code, "VOLUME_NOT_FOUND");
  });

  test("restoreVolume: Thất bại khi volume chưa bị xóa mềm (đang hoạt động)", async () => {
    mock.method(volumeServiceRef, "volumeExist", async () => true);
    mock.method(volumeServiceRef, "volumeIsDeleted", async () => false);
    mock.method(logger, "error", () => {});

    const req = { params: { id: "1" } };
    const res = createMockResponse();

    await restoreVolume(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.code, "VOLUME_NOT_DELETED");
    assert.strictEqual(res.body.message, "Không khôi phục volume chưa bị delete");
  });

  test("restoreVolume: Thành công khôi phục volume", async () => {
    const mockVolume = {
      volume_id: "1",
      journal_id: "1",
      volume_number: 227,
      publication_year: 1970,
      is_deleted: false
    };

    mock.method(volumeServiceRef, "volumeExist", async () => true);
    mock.method(volumeServiceRef, "volumeIsDeleted", async () => true);
    mock.method(volumeServiceRef, "restoreVolume", async () => mockVolume);
    mock.method(logger, "error", () => {});

    const req = { params: { id: "1" } };
    const res = createMockResponse();

    await restoreVolume(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.message, "Khôi phục Volume thành công");
    assert.deepStrictEqual(res.body.data, mockVolume);
  });
});
