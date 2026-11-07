import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  envDir: path.resolve(__dirname, '../../'),
  plugins: [react()],
  resolve: {
    alias: {
      '@apex/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
  server: {
    host: true,
    port: 5174,
    strictPort: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});

