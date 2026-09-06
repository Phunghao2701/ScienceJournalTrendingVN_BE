const DEFAULT_RETRY_DELAYS_MS = [1000, 2000, 4000];

const sleep = (durationMs, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(Object.assign(new Error("Request aborted"), { code: "ABORT_ERR" }));
      return;
    }

    const timeout = setTimeout(resolve, durationMs);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        reject(Object.assign(new Error("Request aborted"), { code: "ABORT_ERR" }));
      },
      { once: true },
    );
  });

const statusOf = (error) => Number(error?.response?.status || error?.status || 0);

export const isRetryableSourceError = (error) => {
  const status = statusOf(error);
  if (status === 408 || status === 429 || status >= 500) return true;

  return [
    "ECONNABORTED",
    "ECONNRESET",
    "ECONNREFUSED",
    "ENETUNREACH",
    "ETIMEDOUT",
    "EAI_AGAIN",
  ].includes(error?.code);
};

const retryAfterMs = (error) => {
  const value = error?.response?.headers?.["retry-after"];
  if (value == null) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - Date.now()) : null;
};

export const withSourceRetry = async (
  operation,
  {
    signal,
    retryDelaysMs = DEFAULT_RETRY_DELAYS_MS,
    random = Math.random,
    onRetry,
  } = {},
) => {
  let attempt = 0;

  while (true) {
    try {
      return await operation(attempt + 1);
    } catch (error) {
      if (
        signal?.aborted ||
        attempt >= retryDelaysMs.length ||
        !isRetryableSourceError(error)
      ) {
        throw error;
      }

      const baseDelay =
        retryAfterMs(error) ?? retryDelaysMs[attempt] ?? retryDelaysMs.at(-1);
      const jitter = Math.round(Math.max(0, baseDelay) * 0.2 * random());
      const delayMs = Math.max(0, baseDelay + jitter);
      attempt += 1;
      onRetry?.({ attempt, delayMs, error });
      await sleep(delayMs, signal);
    }
  }
};
