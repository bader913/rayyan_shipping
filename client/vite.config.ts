import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import brand from '../brand.config.json';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiPort = brand.deployment.defaultApiPort ?? 3000;

  return {
    plugins: [react()],
    // مسار نسبي حتى يعمل نفس البناء في المتصفح وداخل Electron (file://)
    base: './',
    server: {
      port: brand.deployment.defaultWebPort ?? 5173,
      strictPort: false,
      proxy: {
        '/api': {
          target: env.VITE_API_URL || `http://localhost:${apiPort}`,
          changeOrigin: true,
        },
        '/health': {
          target: env.VITE_API_URL || `http://localhost:${apiPort}`,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
      chunkSizeWarningLimit: 1500,
    },
  };
});
