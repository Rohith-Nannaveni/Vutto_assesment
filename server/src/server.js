import http from 'node:http';
import app from './app.js';
import { env } from './config/env.js';
import { connectDb, disconnectDb } from './config/db.js';
import { initSockets } from './sockets/index.js';
import { processDueAuctions, startScheduler, stopScheduler } from './services/lifecycleService.js';
import { logger } from './utils/logger.js';

async function main() {
  await connectDb();

  const server = http.createServer(app);
  const sockets = initSockets(server);

  // Catch up on anything that became due while the server was down or asleep, then keep polling.
  await processDueAuctions();
  startScheduler();

  server.listen(env.PORT, () => logger.info('server.listening', { port: env.PORT, env: env.NODE_ENV }));

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('server.shutdown_started', { signal });
    const force = setTimeout(() => {
      logger.error('server.shutdown_forced');
      process.exit(1);
    }, 10_000);
    force.unref();
    try {
      stopScheduler();
      await sockets.close(); // closes socket connections and the HTTP server
      await disconnectDb();
      logger.info('server.shutdown_complete');
      process.exit(0);
    } catch (err) {
      logger.error('server.shutdown_error', { error: err.message });
      process.exit(1);
    }
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

process.on('unhandledRejection', (reason) => logger.error('process.unhandled_rejection', { error: String(reason) }));
process.on('uncaughtException', (err) => {
  logger.error('process.uncaught_exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

main().catch((err) => {
  logger.error('server.start_failed', { error: err.message });
  process.exit(1);
});
