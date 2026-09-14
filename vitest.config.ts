import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    // Start the app server once for all suites (see tests/global-setup.ts).
    globalSetup: ['tests/global-setup.ts'],
    setupFiles: ['tests/setup-env.ts'],
    // The API tests share one server + one database, so files must not run
    // in parallel.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 180_000,
    include: ['tests/**/*.test.ts'],
  },
});