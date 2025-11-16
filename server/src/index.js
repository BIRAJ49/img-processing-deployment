import http from 'node:http';

import app from './app.js';
import settings from './config.js';
import processor from './jobs/processor.js';
import { initSchema, closePool } from './db.js';
import { findRequeueCandidates } from './services/imageService.js';

const server = http.createServer(app);

async function bootstrap() {
  await initSchema();
  const stuckJobs = await findRequeueCandidates();
  stuckJobs.forEach((id) => processor.enqueue(id));

  server.listen(settings.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on http://localhost:${settings.port}`);
  });
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server', error);
  process.exit(1);
});

async function gracefulShutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(`Received ${signal}, shutting down...`);
  server.close(async () => {
    await closePool();
    process.exit(0);
  });
}

['SIGINT', 'SIGTERM'].forEach((signal) => {
  process.on(signal, () => gracefulShutdown(signal));
});
