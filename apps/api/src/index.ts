import { buildApp } from './app.js';
import { config } from './shared/config.js';

const app = buildApp();

async function start() {
  try {
    await app.listen({ port: config.port, host: config.host });
    console.log(`Acorn API modular-monolith server running on http://localhost:${config.port}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

start();
