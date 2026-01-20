import { defineConfig } from 'vite';
import { builtinModules } from 'module';

// https://vitejs.dev/config
export default defineConfig({
    build: {
        rollupOptions: {
            external: [
                // Electron and Node.js built-ins
                'electron',
                ...builtinModules,
                ...builtinModules.map(m => `node:${m}`),
                // Native modules that need special handling
                'sharp',
                'onnxruntime-node',
                // Puppeteer has its own bundled Chromium
                'puppeteer',
                'puppeteer-core',
            ]
        },
        // Ensure CommonJS modules work properly
        commonjsOptions: {
            ignoreDynamicRequires: true,
        }
    },
    // Resolve node modules in main process
    resolve: {
        conditions: ['node'],
        mainFields: ['module', 'main']
    }
});
