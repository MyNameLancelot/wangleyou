import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: process.env.SITE_BASE || '/wangleyou/',
  test: { include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'] },
});
