const fs = require("fs");
const path = require("path");
const { cleanOldAresArticles } = require("./helpers/mongoDb_async");

const logFile = path.join(__dirname, "cleanupAres.log");

const log = (level, message) => {
  const line = `${new Date().toISOString()} [${level}] ${message}`;
  fs.appendFileSync(logFile, line + "\n");
  console.log(line);
};

const run = async () => {
  const startedAt = Date.now();
  log("START", "ARES cleanup started");

  const result = await cleanOldAresArticles();

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  log(
    "SUCCESS",
    `removed ${result.aresRaw} from aresRaw and ${result.aresData} from aresData; trimmed expired articles from ${result.latestDocumentsUpdated} latest documents and removed ${result.latestDocumentsDeleted} empty latest documents in ${seconds}s`,
  );
};

run()
  .catch((error) => {
    log(
      "FAILURE",
      `ARES cleanup failed: ${error && error.stack ? error.stack : error}`,
    );
    process.exitCode = 1;
  })
  .finally(() => {
    log("END", "ARES cleanup finished");
  });
