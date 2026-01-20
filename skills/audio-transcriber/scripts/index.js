const fs = require('fs');
const path = require('path');

// 1. Parse Arguments (JSON from argv[2])
let args = {};
try {
    args = JSON.parse(process.argv[2] || '{}');
} catch (e) {
    console.error('Failed to parse arguments:', e);
    process.exit(1);
}

const { filePath, language = 'chinese' } = args;

if (!filePath) {
    console.error('Error: filePath argument is required.');
    process.exit(1);
}

// Ensure absolute path
let absolutePath = filePath;
if (!path.isAbsolute(filePath)) {
    absolutePath = path.resolve(process.cwd(), filePath);
}

if (!fs.existsSync(absolutePath)) {
    console.error(`Error: File not found at ${absolutePath}`);
    process.exit(1);
}

console.log(`Requesting transcription for: ${absolutePath} (Language: ${language})`);

const requestId = `req-${Date.now()}`;

// 2. Send request to parent process (SkillManager)
process.send({
    type: 'voice-request',
    id: requestId,
    payload: {
        audioPath: absolutePath, // SkillManager expects 'audioPath'
        language: language
    }
});

// 3. Listen for response
process.on('message', (message) => {
    if (message.type === 'voice-response' && message.id === requestId) {
        if (message.payload && message.payload.error) {
            console.error('Transcription failed:', message.payload.error);
            process.stdout.write(JSON.stringify({ error: message.payload.error }));
            process.exit(1);
        } else if (message.payload && message.payload.text) {
            console.log('Transcription Result:', message.payload.text);
            // Output standardized JSON for the Agent to read
            process.stdout.write(JSON.stringify({
                text: message.payload.text,
                status: 'success'
            }));
            process.exit(0);
        } else {
            console.error('Unknown response format:', message);
            process.exit(1);
        }
    }
});
