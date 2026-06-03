const Queue = require("bull");
const path = require("path");

const { REDIS_PORT, REDIS_URI, REDIS_PASSWORD, REDIS_TLS } = require("../config/redis_credential");

const redisConfig = {
  port: REDIS_PORT,
  host: REDIS_URI,
};
if (REDIS_PASSWORD) {
  redisConfig.password = REDIS_PASSWORD;
}
if (REDIS_TLS) {
  redisConfig.tls = {};
}

const emailQueue = new Queue("emailQueue", {
  redis: redisConfig,
});

emailQueue.process(path.join(__dirname, "./emailQueueProcessor.js"));

emailQueue.on("completed", (job) => {
  console.log(`completed ${job.id}`);
});

emailQueue.on("error", (err) => {
  console.warn("Email queue error (comment emails may fail):", err.message);
});
