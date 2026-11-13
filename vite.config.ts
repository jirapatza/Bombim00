import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // Stable vendor chunks: browsers keep them cached across app releases.
        // The object form only matched the "react-dom" entry point, so
        // "react-dom/client" and the scheduler stayed in the app chunk and the
        // main bundle kept growing past the warning threshold.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) {
            return 'vendor-react';
          }
          return undefined;
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
});
