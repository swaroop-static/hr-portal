import 'dotenv/config';
import { fileURLToPath } from 'url';
import { httpServer, prisma } from './app.js';

// Re-export so existing routes that import from '../index.js' keep working
export { prisma, io } from './app.js';

// Only start the server when this file is the direct entry point
// (not when imported as a module by routes or tests)
const isMain = process.argv[1] &&
  fileURLToPath(import.meta.url).replace(/\\/g, '/') ===
  process.argv[1].replace(/\\/g, '/');

if (isMain) {
  const PORT = process.env.PORT || 5000;

  async function shutdown() {
    console.log('Shutting down gracefully...');
    await prisma.$disconnect();
    httpServer.close(() => {
      console.log('Server closed.');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000);
  }
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`HR Portal backend running on port ${PORT}`);
  });
}
