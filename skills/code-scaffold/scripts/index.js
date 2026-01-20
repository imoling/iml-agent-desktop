const fs = require('fs');
const path = require('path');

// 1. Parse Arguments
const args = JSON.parse(process.argv[2] || '{}');
const { description, target_dir } = args;

if (!description) {
    process.stdout.write(JSON.stringify({ error: "Missing required argument: description" }));
    process.exit(0);
}

// 2. Determine Target Directory
const baseDir = target_dir || path.join(process.cwd(), `scaffold_${Date.now()}`);

// 3. Main Logic
(async () => {
    try {
        // Ensure base directory exists
        if (!fs.existsSync(baseDir)) {
            fs.mkdirSync(baseDir, { recursive: true });
        }

        const systemPrompt = `You are an expert Code Scaffolding Agent.
Your task is to generate file structures and code content based on the user's description.
You must output PURE JSON only. No markdown formatting, no explanations outside the JSON.

Output Format:
{
  "files": [
    {
      "path": "relative/path/to/file.ext",
      "content": "Full code content here..."
    }
  ],
  "summary": "Brief summary of what was generated"
}

IMPORTANT:
- Ensure code is production-ready and functional.
- 'path' must be relative to the project root.
- Do not include system files like node_modules or package-lock.json unless explicitly asked.
`;

        // Send request to LLM via Parent Process
        process.send({
            type: 'llm-request',
            id: 'scaffold-1',
            payload: {
                systemPrompt: systemPrompt,
                messages: [{ role: 'user', content: description }]
            }
        });

        // Listen for LLM response
        process.on('message', (msg) => {
            if (msg.type === 'llm-response' && msg.id === 'scaffold-1') {
                if (msg.payload.error) {
                    process.stdout.write(JSON.stringify({ error: msg.payload.error }));
                } else {
                    try {
                        let content = msg.payload.content;
                        // Attempt to clean markdown code blocks if present (common LLM behavior)
                        content = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');

                        const result = JSON.parse(content);
                        const files = result.files || [];
                        const summary = result.summary || "Generated successfully.";

                        const createdFiles = [];

                        files.forEach(file => {
                            if (file.path && file.content) {
                                const fullPath = path.join(baseDir, file.path);
                                const dirName = path.dirname(fullPath);

                                if (!fs.existsSync(dirName)) {
                                    fs.mkdirSync(dirName, { recursive: true });
                                }

                                fs.writeFileSync(fullPath, file.content, 'utf-8');
                                createdFiles.push(fullPath);
                            }
                        });

                        process.stdout.write(JSON.stringify({
                            output: `${summary}\n\nGenerated ${createdFiles.length} files in:\n${baseDir}\n\nFiles:\n${files.map(f => '- ' + f.path).join('\n')}`
                        }));

                    } catch (e) {
                        process.stdout.write(JSON.stringify({ error: "Failed to parse LLM response: " + e.message + "\nRaw response: " + msg.payload.content }));
                    }
                }
                process.exit(0);
            }
        });

    } catch (error) {
        process.stdout.write(JSON.stringify({ error: error.message }));
        process.exit(0);
    }
})();
