const fs = require('fs');
const path = require('path');

// Helper to communicate with Parent (LLM Service)
function callLLM(messages, systemPrompt) {
    return new Promise((resolve, reject) => {
        const requestId = Date.now().toString() + Math.random().toString();

        const listener = (msg) => {
            if (msg.type === 'llm-response' && msg.id === requestId) {
                process.removeListener('message', listener);
                if (msg.payload.error) {
                    reject(new Error(msg.payload.error));
                } else {
                    resolve(msg.payload.content);
                }
            }
        };

        process.on('message', listener);

        process.send({
            type: 'llm-request',
            id: requestId,
            payload: { messages, systemPrompt }
        });
    });
}

process.on('message', async (msg) => {
    if (msg.type === 'start') {
        const args = msg.payload || {};
        const input = args.input;

        if (!input) {
            console.error('No input provided');
            process.exit(1);
        }

        try {
            console.log(`Received input: ${input.slice(0, 50)}...`);

            let content = input;

            // Check if input is a file path
            if (fs.existsSync(input)) {
                const ext = path.extname(input).toLowerCase();
                if (['.mp3', '.wav', '.m4a', '.mp4'].includes(ext)) {
                    console.error('Error: Audio/Video transcription is not yet configured. Please provide a text transcript file (.txt, .md).');
                    process.exit(1);
                }

                console.log(`Reading file: ${input}`);
                const stats = fs.statSync(input);
                if (stats.isFile()) {
                    content = fs.readFileSync(input, 'utf-8');
                }
            }

            console.log(`Processing content length: ${content.length} characters`);

            // Simple chunking if needed (for now, trust the context window of DeepSeek/Claude)
            // Construct prompt
            const messages = [
                {
                    role: 'user', content: `Please generate a structured meeting summary for the following transcript. Include:
1. Executive Summary
2. Key Discussion Points
3. Action Items (with owners if mentioned)
4. Decisions Made

Transcript:
${content}`
                }
            ];

            console.log('Sending request to LLM...');
            const summary = await callLLM(messages, "You are an expert meeting minute taker.");

            // console.log('Summary generated.');
            // console.log(summary);

            // Output result
            process.stdout.write(summary);
            // The SkillManager captures stdout as output.
        } catch (error) {
            console.error('Error processing meeting notes:', error);
            process.exit(1);
        } finally {
            process.exit(0);
        }
    }
});
