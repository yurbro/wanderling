import { defineConfig } from 'vite';

// Served from https://yurbro.github.io/wanderling/ (GitHub Pages project site).
export default defineConfig({
  base: '/wanderling/',
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
} as Parameters<typeof defineConfig>[0]);
