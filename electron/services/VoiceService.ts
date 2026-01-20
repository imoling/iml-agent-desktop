import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
// @ts-ignore
import { env } from '@xenova/transformers'; // Keep for other uses (embeddings)

const OpenCC = require('opencc-js');

export class VoiceService {
    // Path to whisper-cli binary (relative to project root)
    private whisperBinaryPath: string;
    private modelPath: string;
    private isDownloading = false;

    constructor() {
        // Resolve paths relative to the app
        // Uses resources/whisper/ folder which contains only the binary and models
        const appPath = app.getAppPath();
        console.log(`[VoiceService] App Path: ${appPath}`);

        const basePath = app.isPackaged
            ? path.join(process.resourcesPath, 'whisper')
            : path.join(appPath, 'resources', 'whisper');

        this.whisperBinaryPath = path.join(basePath, 'bin', 'whisper-cli');
        this.modelPath = path.join(basePath, 'models', 'ggml-tiny.bin');

        console.log(`[VoiceService] Whisper Binary: ${this.whisperBinaryPath}`);
        console.log(`[VoiceService] Model Path: ${this.modelPath}`);

        // Keep transformers env setup for other potential uses
        const userDataPath = app.getPath('userData');
        env.localModelPath = path.join(userDataPath, 'models');
        env.allowRemoteModels = true;
        env.allowLocalModels = true;
    }

    // Set model ID (for future multi-model support)
    setModel(modelId: string) {
        console.log(`[VoiceService] setModel called with: "${modelId}"`);

        // Map common names to actual model files
        const modelMap: Record<string, string> = {
            'Xenova/whisper-tiny': 'ggml-tiny.bin',
            'ggml-tiny': 'ggml-tiny.bin',
            'ggml-tiny.bin': 'ggml-tiny.bin',
            'ggml-base': 'ggml-base.bin',
            'ggml-base.bin': 'ggml-base.bin',
            'ggml-small': 'ggml-small.bin',
            'ggml-small.bin': 'ggml-small.bin',
            'ggml-medium': 'ggml-medium.bin',
            'ggml-medium.bin': 'ggml-medium.bin',
            'ggml-large': 'ggml-large.bin',
            'ggml-large.bin': 'ggml-large.bin',
        };
        const modelFile = modelMap[modelId] || modelId; // Use modelId directly if not in map
        console.log(`[VoiceService] Resolved to file: "${modelFile}"`);

        const basePath = app.isPackaged
            ? path.join(process.resourcesPath, 'whisper')
            : path.join(app.getAppPath(), 'resources', 'whisper');

        this.modelPath = path.join(basePath, 'models', modelFile);
        console.log(`[VoiceService] Model path set to: ${this.modelPath}`);
    }

    // Check if model exists locally
    async getModelStatus() {
        const binaryExists = fs.existsSync(this.whisperBinaryPath);
        const modelExists = fs.existsSync(this.modelPath);
        const isReady = binaryExists && modelExists;

        console.log(`[VoiceService] Status - Binary: ${binaryExists}, Model: ${modelExists}, Ready: ${isReady}`);

        return {
            id: path.basename(this.modelPath),
            downloaded: isReady,
            downloading: this.isDownloading,
            path: isReady ? this.modelPath : null
        };
    }

    // Trigger download from HuggingFace
    async downloadModel(onProgress?: (data: any) => void) {
        const status = await this.getModelStatus();
        if (status.downloaded) {
            console.log('[VoiceService] Model already exists.');
            return true;
        }

        if (this.isDownloading) return;
        this.isDownloading = true;

        const modelFileName = path.basename(this.modelPath);
        console.log(`[VoiceService] Downloading model: ${modelFileName}`);

        // Download from huggingface
        const https = require('https');
        const url = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${modelFileName}`;

        // Ensure models directory exists
        const modelsDir = path.dirname(this.modelPath);
        if (!fs.existsSync(modelsDir)) {
            fs.mkdirSync(modelsDir, { recursive: true });
        }

        const file = fs.createWriteStream(this.modelPath);

        try {
            await new Promise((resolve, reject) => {
                const request = https.get(url, (response: any) => {
                    // Handle redirect
                    if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                        https.get(response.headers.location, (res2: any) => {
                            if (res2.statusCode !== 200) {
                                reject(new Error(`Failed to download model: ${res2.statusCode}`));
                                return;
                            }
                            handleResponse(res2);
                        }).on('error', reject);
                        return;
                    }

                    if (response.statusCode !== 200) {
                        reject(new Error(`Failed to download model: ${response.statusCode}`));
                        return;
                    }
                    handleResponse(response);

                    function handleResponse(res: any) {
                        const totalSize = parseInt(res.headers['content-length'] || '0', 10);
                        let downloaded = 0;

                        res.on('data', (chunk: Buffer) => {
                            downloaded += chunk.length;
                            if (onProgress && totalSize > 0) {
                                const percent = (downloaded / totalSize) * 100;
                                onProgress({ status: 'progress', file: modelFileName, progress: percent });
                            }
                        });

                        res.pipe(file);

                        file.on('finish', () => {
                            file.close();
                            resolve(true);
                        });
                    }
                });

                request.on('error', (err: Error) => {
                    fs.unlink(this.modelPath, () => { });
                    reject(err);
                });
            });

            this.isDownloading = false;
            console.log('[VoiceService] Model downloaded successfully.');
            return true;
        } catch (error) {
            this.isDownloading = false;
            console.error('[VoiceService] Download failed:', error);
            if (fs.existsSync(this.modelPath)) {
                fs.unlinkSync(this.modelPath);
            }
            throw error;
        }
    }

    // Helper: Convert audio to 16kHz WAV (required by whisper.cpp)
    private convertToWav(inputPath: string): string {
        // Resolve ffmpeg path
        let ffmpegPath;
        try {
            ffmpegPath = require('ffmpeg-static').replace('app.asar', 'app.asar.unpacked');
        } catch (e) {
            try {
                ffmpegPath = require('ffmpeg-static');
            } catch (e2) {
                ffmpegPath = 'ffmpeg';
            }
        }

        const ext = path.extname(inputPath).toLowerCase();

        // Always convert to ensure proper format (16kHz, mono, s16le)
        const tempPath = path.join(app.getPath('temp'), `whisper_input_${Date.now()}.wav`);

        console.log(`[VoiceService] Converting audio to 16kHz WAV...`);
        try {
            const cmd = `"${ffmpegPath}" -y -i "${inputPath}" -ar 16000 -ac 1 -c:a pcm_s16le "${tempPath}"`;
            console.log(`[VoiceService] Executing: ${cmd}`);
            execSync(cmd);
            return tempPath;
        } catch (e: any) {
            console.error('[VoiceService] FFmpeg conversion failed:', e);
            throw new Error('Audio conversion failed');
        }
    }

    // Transcribe audio file
    async transcribe(audioInput: string | Float32Array, language: string = 'chinese') {
        const status = await this.getModelStatus();
        if (!status.downloaded) {
            throw new Error('Whisper model not ready. Please ensure whisper-cpp-native is built.');
        }

        console.log(`[VoiceService] Transcribing with whisper.cpp... (Lang: ${language})`);

        let tempWavPath: string | null = null;

        try {
            // Handle input
            let wavPath: string;

            if (typeof audioInput === 'string') {
                // Convert to proper WAV format
                wavPath = this.convertToWav(audioInput);
                tempWavPath = wavPath;
            } else if (audioInput instanceof Float32Array || ArrayBuffer.isView(audioInput)) {
                // Handle buffer input: Save to temp WAV file first
                console.log('[VoiceService] Received audio buffer, saving to temp WAV...');
                const { WaveFile } = require('wavefile');

                // Create WAV file from Float32Array
                const wav = new WaveFile();
                // Assume 16kHz mono float32 input
                wav.fromScratch(1, 16000, '32f', audioInput);
                // Convert to 16-bit for whisper.cpp compatibility
                wav.toBitDepth('16');

                const tempBufferPath = path.join(app.getPath('temp'), `whisper_buffer_${Date.now()}.wav`);
                fs.writeFileSync(tempBufferPath, wav.toBuffer());

                wavPath = tempBufferPath;
                tempWavPath = wavPath;
            } else {
                throw new Error('Invalid audio input type.');
            }

            // Map language names to whisper language codes
            const langMap: Record<string, string> = {
                'chinese': 'zh',
                'english': 'en',
                'japanese': 'ja',
                'korean': 'ko',
                'auto': 'auto',
            };
            const langCode = langMap[language] || language;

            // Build whisper-cli command
            // Output to stdout (-otxt to stdout doesn't work well, use -o and read file)
            const outputPath = path.join(app.getPath('temp'), `whisper_output_${Date.now()}`);

            const cmd = [
                `"${this.whisperBinaryPath}"`,
                `-m "${this.modelPath}"`,
                `-f "${wavPath}"`,
                `-l ${langCode}`,
                `-t 4`, // 4 threads
                `--no-timestamps`, // Cleaner output
                `-otxt`, // Output as text
                `-of "${outputPath}"` // Output file base
            ].join(' ');

            console.log(`[VoiceService] Running: ${cmd}`);

            try {
                execSync(cmd, { timeout: 60000 }); // 60s timeout
            } catch (e: any) {
                console.error('[VoiceService] Whisper execution failed:', e.stderr?.toString() || e.message);
                throw new Error('Whisper transcription failed');
            }

            // Read output file
            const txtPath = `${outputPath}.txt`;
            if (!fs.existsSync(txtPath)) {
                throw new Error('Whisper output file not found');
            }

            let text = fs.readFileSync(txtPath, 'utf-8').trim();

            // Cleanup output file
            fs.unlinkSync(txtPath);

            // OpenCC conversion for Chinese
            if ((langCode === 'zh' || language === 'chinese') && text) {
                try {
                    const converter = OpenCC.Converter({ from: 'hk', to: 'cn' });
                    text = converter(text);
                } catch (e) {
                    console.error('[VoiceService] OpenCC conversion failed:', e);
                }
            }

            console.log('[VoiceService] Result:', { text });
            return { text };

        } catch (error) {
            console.error('[VoiceService] Transcription Error:', error);
            throw error;
        } finally {
            // Cleanup temp WAV
            if (tempWavPath && fs.existsSync(tempWavPath)) {
                fs.unlinkSync(tempWavPath);
            }
        }
    }
}
