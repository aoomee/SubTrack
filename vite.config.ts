import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig(() => {
  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
    build: {
      // Use esbuild for faster builds and better CSP compatibility
      minify: 'esbuild' as const,
      // Ensure proper chunking for production
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('recharts') || id.includes('d3-')) {
                return 'vendor-charts'
              }
              if (id.includes('@radix-ui/')) {
                return 'vendor-ui'
              }
              if (id.includes('zustand') || id.includes('date-fns') || id.includes('lucide-react')) {
                return 'vendor-utils'
              }
            }
            if (
              id.includes('/src/components/charts/CategoryPieChart.tsx') ||
              id.includes('/src/components/charts/ExpenseTrendChart.tsx') ||
              id.includes('/src/components/charts/YearlyTrendChart.tsx')
            ) {
              return 'charts'
            }
          },
        },
      },
      // Increase chunk size warning limit since we're optimizing
      chunkSizeWarningLimit: 1000,
    },
    // Configure for production deployment
    base: '/',
  }
})