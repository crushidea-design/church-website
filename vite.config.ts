import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    build: {
      target: 'esnext',
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          next: path.resolve(__dirname, 'next.html'),
        },
        output: {
          // Split heavy vendors into their own chunks so the initial main
          // bundle stays small and updates to app code don't bust the cache
          // for unchanged libraries. Lazy-loaded routes still get their own
          // chunks via React.lazy().
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('/firebase/') || id.includes('@firebase/')) return 'firebase';
            if (id.includes('/react-router')) return 'react-router';
            if (id.includes('/react-dom/') || id.match(/\/react\/[^/]+$/)) return 'react';
            if (id.includes('/motion/') || id.includes('framer-motion')) return 'motion';
            if (id.includes('/lucide-react/')) return 'icons';
            if (id.includes('/sonner/')) return 'sonner';
            if (id.includes('/pdfjs-dist/')) return 'pdf';
            return undefined;
          },
        },
      },
    },
    optimizeDeps: {
      esbuildOptions: {
        target: 'esnext',
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
