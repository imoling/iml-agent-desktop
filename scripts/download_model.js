const path = require('path');
const fs = require('fs');
const { pipeline, env } = require('@xenova/transformers');

// Configure mirror for download
env.remoteHost = 'https://hf-mirror.com/';
env.localModelPath = path.join(__dirname, '../resources/models');
env.allowRemoteModels = true;
env.allowLocalModels = true;

async function downloadModel() {
    console.log('Using local model path:', env.localModelPath);
    console.log('Downloading Xenova/paraphrase-multilingual-MiniLM-L12-v2 from hf-mirror.com...');

    try {
        // This triggers the download and caching to env.localModelPath
        await pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2', {
            cache_dir: env.localModelPath
        });
        console.log('Download complete!');
    } catch (error) {
        console.error('Download failed:', error);
        process.exit(1);
    }
}

downloadModel();
