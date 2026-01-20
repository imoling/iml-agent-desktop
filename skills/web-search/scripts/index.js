const https = require('https');

// Read input
const args = JSON.parse(process.argv[2] || '{}');
const query = args.query;

if (!query) {
    process.stdout.write(JSON.stringify({ error: "Missing required argument: query" }));
    process.exit(0);
}

// Fetch API Key from Env or Config (Passed via Env Var usually, but for now we rely on SkillManager injection or we might need to read config directly if not injected)
// Architecture note: SkillManager currently execs the script. It does NOT automatically inject environment variables from the ConfigManager.
// We should probably read the config.json directly or assume the main process passed it?
// Simpler approach for now: Read config.json from user data path? No, that's brittle.
// BETTER APPROACH: The SkillManager should pass global config/keys to the skill execution context.
// But we haven't implemented that yet. 
// Workaround: We will use a dedicated IPC call or file read? No, skills are separate processes.
// Let's assume the SkillManager transmits keys via environment variables or arguments.
// Current SkillManager.ts logic: `spawn('node', [scriptPath, JSON.stringify(args)])`.
// It does NOT pass env or extra args.
// 
// IMMEDIATE FIX: I will update SkillManager to pass process.env + any config keys as environment variables to the child process.
// Then this script can read process.env.TAVILY_API_KEY.

const apiKey = process.env.TAVILY_API_KEY;

if (!apiKey) {
    process.stdout.write(JSON.stringify({
        error: "Configuration Error: TAVILY_API_KEY is missing. Please set it in the Models/Settings view."
    }));
    process.exit(0);
}

// Simple HTTP Request to Tavily
const data = JSON.stringify({
    query: query,
    search_depth: "basic",
    include_answer: true,
    max_results: 5
});

const options = {
    hostname: 'api.tavily.com',
    port: 443,
    path: '/search',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'Authorization': `Bearer ${apiKey}` // Assuming Bearer or just parameter
    }
    // Tavily docs say: POST https://api.tavily.com/search, body { api_key: "..." } OR header?
    // Checking standard usage: usually body 'api_key' or header. Let's send in body to be safe if header is uncertain, but docs often use body.
    // Re-reading mock docs: "Authorization: Bearer <api_key>" is common for modern APIs, but Tavily often accepts { api_key: ... } in body.
    // I'll put it in the body to be safe as per common Tavily examples.
};

const reqBody = {
    api_key: apiKey,
    query: query,
    search_depth: "basic",
    include_answer: true,
    max_results: 5
};
const reqData = JSON.stringify(reqBody);

const req = https.request({
    hostname: 'api.tavily.com',
    path: '/search',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': reqData.length
    }
}, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
                const json = JSON.parse(body);
                // Return the answer and results
                const output = {
                    answer: json.answer,
                    results: json.results.map(r => ({ title: r.title, url: r.url, snippet: r.content }))
                };
                process.stdout.write(JSON.stringify({ output }));
            } catch (e) {
                process.stdout.write(JSON.stringify({ error: "Failed to parse API response: " + e.message }));
            }
        } else {
            process.stdout.write(JSON.stringify({ error: `API Request Failed: ${res.statusCode} ${body}` }));
        }
    });
});

req.on('error', (e) => {
    process.stdout.write(JSON.stringify({ error: `Request Error: ${e.message}` }));
});

req.write(reqData);
req.end();
