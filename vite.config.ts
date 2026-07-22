import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Versione generata al momento della compilazione.
// Formato: V25-26.22.07.12.36  →  stagione 2025-26, creata il 22/07 alle 12:36
function buildVersion(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const yy = d.getFullYear() % 100;
  return `V${p(yy - 1)}-${p(yy)}.${p(d.getDate())}.${p(d.getMonth() + 1)}.${p(d.getHours())}.${p(d.getMinutes())}`;
}

// Base './' rende la build utilizzabile anche da sottocartelle o file://
export default defineConfig({
  plugins: [react()],
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(buildVersion()),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  build: { outDir: 'dist', sourcemap: false },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
} as any);
