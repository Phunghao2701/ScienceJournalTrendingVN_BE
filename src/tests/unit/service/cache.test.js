import test from "node:test";
import assert from "node:assert/strict";
import { buildCacheKey, createCache } from "../../../utils/cache.js";

const createFakeClient = () => {
  const values = new Map();
  const writes = [];

  return {
    values,
    writes,
    async get(key) {
      return values.get(key) ?? null;
    },
    async set(key, value, mode, ttlSeconds) {
      values.set(key, value);
      writes.push({ key, mode, ttlSeconds });
    },
  };
};

test("buildCacheKey sorts and safely encodes query parameters", () => {
  assert.equal(
    buildCacheKey("list", { search: "a:b", page: 1, ignored: undefined }, "articles"),
    "articles:list:page=1:search=a%3Ab"
  );
});

test("getOrSetCache coalesces concurrent cold misses", async () => {
  const client = createFakeClient();
  const cache = createCache({ client, cacheLogger: { error() {} } });
  let fetchCount = 0;
  let resolveFetch;
  const fetchPromise = new Promise((resolve) => { resolveFetch = resolve; });
  const fetchFn = async () => {
    fetchCount += 1;
    return fetchPromise;
  };

  const first = cache.getOrSetCache("key", fetchFn);
  const second = cache.getOrSetCache("key", fetchFn);
  resolveFetch({ ok: true });

  assert.deepEqual(await first, { ok: true });
  assert.deepEqual(await second, { ok: true });
  assert.equal(fetchCount, 1);
  assert.equal(client.writes.length, 1);
});

test("getOrSetCache serves stale data while refreshing in the background", async () => {
  const client = createFakeClient();
  let currentTime = 0;
  const cache = createCache({
    client,
    cacheLogger: { error() {} },
    now: () => currentTime,
  });

  assert.equal(
    await cache.getOrSetCache("key", async () => "initial", {
      freshTtlSeconds: 10,
      staleTtlSeconds: 100,
    }),
    "initial"
  );

  currentTime = 11_000;
  let refreshed = false;
  const staleValue = await cache.getOrSetCache("key", async () => {
    refreshed = true;
    return "updated";
  }, {
    freshTtlSeconds: 10,
    staleTtlSeconds: 100,
  });

  assert.equal(staleValue, "initial");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(refreshed, true);

  const stored = JSON.parse(client.values.get("key"));
  assert.equal(stored.data, "updated");
  assert.equal(client.writes.at(-1).ttlSeconds, 100);
});
