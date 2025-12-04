import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node18',
  clean: true,
  splitting: false,
  sourcemap: true,
  minify: false,
  shims: true,
  dts: true,
  external: ['@prisma/client'],
});
