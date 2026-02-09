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

module.exports = {
    packagerConfig: {
        icon: './resources/icon',
        asar: {
            // Don't pack native modules into asar to avoid loading issues
            unpack: '**/node_modules/{vectra,@xenova,onnxruntime-node,sharp,puppeteer,puppeteer-core}/**/*'
        },
        // Copy necessary files
        extraResource: [
            './skills',
            './resources/models', // Includes embeddings and whisper
            './resources/icon.png',
            './resources/icon.icns'
        ],
        // Ignore unnecessary files to reduce bundle size
        ignore: [
            /^\/\.git/,
            /^\/\.vscode/,
            /^\/src$/,
            /^\/electron$/,
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
