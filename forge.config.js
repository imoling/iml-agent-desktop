const path = require('path');
const fs = require('fs');

// Native modules that need to be copied to the packaged app
const NATIVE_MODULES = [
    'vectra',
    '@xenova/transformers',
    'onnxruntime-node',
    'puppeteer-core',
    'wavefile'
];

// Prepare temp resources for packaging (Xenova only, exclude Whisper)
const TEMP_RES = path.join(__dirname, 'temp_resources');
if (fs.existsSync(TEMP_RES)) {
    fs.rmSync(TEMP_RES, { recursive: true, force: true });
}
fs.mkdirSync(path.join(TEMP_RES, 'models'), { recursive: true });

// Copy Xenova models
const xenovaSrc = path.join(__dirname, 'resources', 'models', 'Xenova');
const xenovaDest = path.join(TEMP_RES, 'models', 'Xenova');
if (fs.existsSync(xenovaSrc)) {
    console.log('Copying Xenova models for packaging...');
    fs.cpSync(xenovaSrc, xenovaDest, { recursive: true });
}

module.exports = {
    packagerConfig: {
        icon: './resources/icon',
        asar: {
            // Don't pack native modules into asar to avoid loading issues
            unpack: '**/node_modules/{vectra,@xenova,onnxruntime-node,sharp,puppeteer,puppeteer-core}/**/*'
        },
        // Copy necessary files
        extraResource: [
            // './skills', // Externalized manually
            './temp_resources/models', // Includes only Xenova
            './resources/icon.png',
            './resources/icon.icns'
        ],
        // Ignore unnecessary files to reduce bundle size
        ignore: [
            /^\/\.git/,
            /^\/\.vscode/,
            /^\/src$/,
            /^\/electron$/,
            /^\/out$/,
            /^\/temp_resources$/,
            /^\/skills($|\/)/,     // EXCLUDE skills from app bundle (loaded from external Resources)
            /^\/resources\/models($|\/)/, // EXCLUDE models from app bundle (Xenova loaded from external Resources)
            /\.ts$/,
            /\.md$/
        ]
    },
    rebuildConfig: {},
    hooks: {
        packageAfterPrune: async (forgeConfig, buildPath, electronVersion, platform, arch) => {
            // Copy native modules that were pruned
            const sourceNodeModules = path.join(__dirname, 'node_modules');
            const targetNodeModules = path.join(buildPath, 'node_modules');

            // Ensure target node_modules exists
            if (!fs.existsSync(targetNodeModules)) {
                fs.mkdirSync(targetNodeModules, { recursive: true });
            }

            for (const mod of NATIVE_MODULES) {
                const sourcePath = path.join(sourceNodeModules, mod);
                const targetPath = path.join(targetNodeModules, mod);

                if (fs.existsSync(sourcePath) && !fs.existsSync(targetPath)) {
                    console.log(`Copying native module: ${mod}`);
                    fs.cpSync(sourcePath, targetPath, { recursive: true });
                }
            }
        },
        postMake: async () => {
            // Cleanup temp resources
            if (fs.existsSync(TEMP_RES)) {
                console.log('Cleaning up temp resources...');
                fs.rmSync(TEMP_RES, { recursive: true, force: true });
            }
        }
    },
    makers: [
        {
            name: '@electron-forge/maker-zip',
            platforms: ['darwin'],
        },
    ],
    plugins: [
        {
            name: '@electron-forge/plugin-vite',
            config: {
                // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
                // If you are familiar with Vite configuration, it will look really familiar.
                build: [
                    {
                        // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
                        entry: 'electron/main.ts',
                        config: 'vite.main.config.ts',
                    },
                    {
                        entry: 'electron/preload.ts',
                        config: 'vite.preload.config.ts',
                    },
                ],
                renderer: [
                    {
                        name: 'main_window',
                        config: 'vite.renderer.config.ts',
                    },
                ],
            },
        },
    ],
};
