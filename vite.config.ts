import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isReplit = Boolean(process.env.REPL_ID || process.env.REPLIT);

export default defineConfig({
  plugins: [
    react(),
    // Replit-only: local dev this overlay + external replit banner often cause noisy reloads / bad UX
    ...(isReplit ? [runtimeErrorOverlay()] : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
    // Ensure proper module resolution across Node versions
    dedupe: ['lucide-react', 'react', 'react-dom'],
  },
  root: "client",
  build: {
    outDir: "../dist/public",
    emptyOutDir: true,
    sourcemap: false, // faster deploys; enable only when debugging
    // Ensure all imports are properly resolved regardless of Node version
    commonjsOptions: {
      include: [/lucide-react/, /node_modules/],
      transformMixedEsModules: true,
    },
    // Add build timestamp to filenames for cache busting
    rollupOptions: {
      output: {
        // Vite already adds hashes to filenames, but ensure they're always unique
        entryFileNames: `assets/[name]-[hash].js`,
        chunkFileNames: `assets/[name]-[hash].js`,
        assetFileNames: `assets/[name]-[hash].[ext]`,
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5000,
    strictPort: true,
    allowedHosts: true,
    hmr: false, // Disable HMR to prevent WebSocket connection errors
    watch: {
      usePolling: false,
      // Avoid rebuild storms when Node touches logs, server TS, JWT cache, etc. (root is `client`, paths are relative to it)
      ignored: [
        "**/node_modules/**",
        "**/.git/**",
        "../server/**",
        "../dist/**",
        "../attached_assets/**",
        "../*.log",
        "../hppro_jwt_cache.json",
        "../**/.cursor/**",
      ],
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:5001',
        ws: true,
      }
    }
  },
});
