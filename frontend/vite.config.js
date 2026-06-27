import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    build: {
        rollupOptions: {
            output: {
                // Forma de función: cada módulo se asigna por su archivo físico,
                // así react-dom siempre cae en vendor-react (necesario al arrancar)
                // y recharts/d3 en vendor-charts (lazy, solo con el Dashboard),
                // sin que react-dom "arrastre" recharts al arranque.
                manualChunks(id) {
                    if (!id.includes('node_modules')) return;
                    if (id.includes('recharts') || id.includes('d3-') || id.includes('victory') || id.includes('internmap')) return 'vendor-charts';
                    if (id.includes('react-dom') || id.includes('scheduler') || id.includes('/react/') || id.includes('react/jsx')) return 'vendor-react';
                    if (id.includes('@supabase')) return 'vendor-supabase';
                },
            },
        },
    },
    test: {
        environment: 'node',
        include: ['src/**/*.test.{js,jsx}'],
    },
})
