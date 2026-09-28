import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.js', 'tests/physics/**/*.test.js', 'tests/integration/**/*.test.js'],
    globals: false,
    testTimeout: 15000,
  },
});
