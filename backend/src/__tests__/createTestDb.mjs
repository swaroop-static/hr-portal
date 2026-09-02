import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';
import { platform } from 'process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendDir = resolve(__dirname, '..', '..');
const testDbPath = resolve(backendDir, 'prisma', 'test.db').replace(/\\/g, '/');
const testDbUrl = `file:${testDbPath}`;
const prismaCli = resolve(backendDir, 'node_modules', 'prisma', 'build', 'index.js');

let result;

if (platform === 'win32') {
  // Windows: .cmd files need cmd.exe
  const prismaBin = resolve(backendDir, 'node_modules', '.bin', 'prisma.cmd');
  result = spawnSync('C:\\Windows\\System32\\cmd.exe', [
    '/c', prismaBin, 'db', 'push', '--skip-generate'
  ], {
    cwd: backendDir,
    env: { ...process.env, DATABASE_URL: testDbUrl },
    stdio: 'inherit',
  });
} else {
  // Linux / macOS: invoke the prisma CLI directly via node
  result = spawnSync(process.execPath, [prismaCli, 'db', 'push', '--skip-generate'], {
    cwd: backendDir,
    env: { ...process.env, DATABASE_URL: testDbUrl },
    stdio: 'inherit',
  });
}

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
