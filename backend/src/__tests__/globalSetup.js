import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendDir = resolve(__dirname, '..', '..');
const testDbPath = resolve(backendDir, 'prisma', 'test.db').replace(/\\/g, '/');

// Sets env vars in the MAIN Vitest process. Workers are forked from here and
// inherit these values, so app.js's `import 'dotenv/config'` sees DATABASE_URL
// already set and does not override it with the production .env value.
export default function setup() {
  process.env.DATABASE_URL = `file:${testDbPath}`;
  process.env.JWT_SECRET = 'test-secret-key';
  process.env.ALLOW_DIRECT_EXECUTION = 'true';
  process.env.NODE_ENV = 'test';
}
