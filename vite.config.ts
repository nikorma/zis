import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Base './' rende la build utilizzabile anche da sottocartelle o file://
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist', sourcemap: false },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
} as any);
