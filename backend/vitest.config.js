import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    globalSetup: './src/__tests__/globalSetup.js',
    setupFiles: ['./src/__tests__/setup.js'],
    testTimeout: 15000,
    pool: 'forks',
    forks: { singleFork: true },
    sequence: { concurrent: false },
  },
});
