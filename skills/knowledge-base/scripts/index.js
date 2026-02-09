const fs = require('fs');

// Read input from arguments
const args = JSON.parse(process.argv[2] || '{}');
const { action, content, query, limit, category, priority, tags, encrypted, expires_in } = args;

// Validation
if (!action) {
    process.stdout.write(JSON.stringify({ error: "Missing required argument: action" }));
    process.exit(0);
}

if (action === 'add' && !content) {
    process.stdout.write(JSON.stringify({ error: "Missing required argument: content for 'add' action" }));
    process.exit(0);
}

if (action === 'search' && !query) {
    process.stdout.write(JSON.stringify({ error: "Missing required argument: query for 'search' action" }));
    process.exit(0);
}

// Function to send IPC request and wait for response
function sendRequest(type, payload) {
    return new Promise((resolve, reject) => {
        const id = Math.random().toString(36).substring(7);

        // Listen for response
        const handler = (msg) => {
            if (msg.type === 'memory-response' && msg.id === id) {
                process.removeListener('message', handler);
                if (msg.payload.error) {
                    reject(new Error(msg.payload.error));
                } else {
                    resolve(msg.payload.data);
                }
            }
        };
        process.on('message', handler);

        // Send request
        process.send({
            type: 'memory-request',
            id,
            payload
        });

        // Timeout fallback
        setTimeout(() => {
            process.removeListener('message', handler);
            reject(new Error('Timeout waiting for memory response'));
        }, 10000);
    });
}

(async () => {
    try {
        let output;

        if (action === 'add') {
            await sendRequest('memory-request', {
                action: 'add',
                content,
                // Pass rich metadata to MemoryManager
                metadata: {
                    source: 'knowledge-base-skill',
                    date: new Date().toISOString()
                },
                options: {
                    category,
                    priority,
                    tags,
                    encrypted,
                    expiresAt: expires_in ? Date.now() + (expires_in * 1000) : undefined
                }
            });
            output = "Successfully added to memory.";
        } else if (action === 'search') {
            const results = await sendRequest('memory-request', {
                action: 'search',
                query,
                limit: limit || 3
            });
            output = results;
        } else {
            throw new Error(`Unknown action: ${action}`);
        }

        process.stdout.write(JSON.stringify({ output }));
    } catch (error) {
        process.stdout.write(JSON.stringify({
            error: `Memory operation failed: ${error.message}`
        }));
    }
})();
