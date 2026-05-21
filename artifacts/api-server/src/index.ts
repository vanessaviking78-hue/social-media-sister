import app from "./app";
import { logger } from "./lib/logger";
import { runMigrations } from "./lib/runMigrations";
import { seedClients } from "./lib/seedClients";
import { startSchedulerCron } from "./lib/schedulerEngine";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start(): Promise<void> {
  await runMigrations();
  await seedClients();

  await new Promise<void>((resolve, reject) => {
    app.listen(port, (err?: Error) => {
      if (err) {
        reject(err);
      } else {
        logger.info({ port }, "Server listening");
        resolve();
      }
    });
  });

  startSchedulerCron();
}

start().catch((err) => {
  logger.error({ err }, "Server failed to start");
  process.exit(1);
});
