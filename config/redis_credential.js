function fromEnv() {
  if (process.env.REDIS_URL) {
    const url = new URL(process.env.REDIS_URL);
    return {
      REDIS_URI: url.hostname,
      REDIS_PORT: parseInt(url.port || "6379", 10),
      REDIS_PASSWORD: url.password
        ? decodeURIComponent(url.password)
        : undefined,
      REDIS_TLS: url.protocol === "rediss:",
    };
  }

  return {
    REDIS_URI: process.env.REDIS_HOST || "127.0.0.1",
    REDIS_PORT: parseInt(process.env.REDIS_PORT || "6379", 10),
    REDIS_PASSWORD: process.env.REDIS_PASSWORD || undefined,
    REDIS_TLS: process.env.REDIS_TLS === "true",
  };
}

module.exports = fromEnv();
