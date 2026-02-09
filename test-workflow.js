const { execFileSync } = require('child_process');
const path = require('path');

const SKILL_SCRIPT = path.join(__dirname, 'skills/browser-automation/scripts/index.js');

function callSkill(action, params = {}) {
    const args = JSON.stringify({ action, ...params });
    console.log(`\n>>> Executing: ${action} ${JSON.stringify(params)}`);
    try {
        const output = execFileSync('node', [SKILL_SCRIPT, args], { encoding: 'utf-8' });
        console.log('Output:', output.trim().substring(0, 200) + (output.length > 200 ? '...' : ''));
        return JSON.parse(output);
    } catch (e) {
        console.error('Error:', e.message);
        return { error: e.message };
    }
}

async function runTest() {
    // 1. Navigate
    callSkill('navigate', { url: 'https://en.wikipedia.org/wiki/Main_Page' });

    // 2. Type Search
    // Wikipedia search input usually has name="search" or class="cdx-text-input__input"
    // Let's use a generic selector if possible, or try semantic finding if agent-browser supports it via 'find'
    // But our skill wrapper maps 'type' to 'fill'.
    // Let's try to match the input. Selector: 'input[name="search"]'
    callSkill('type', { selector: 'input[name="search"]', text: 'Deep learning' });

    // 3. Submit
    callSkill('press_key', { key: 'Enter' });

    // Wait for page load (agent-browser usually waits for load, but search might be SPA or quick)
    // We can use a small delay or just proceed since executeFileSync is synchronous but the browser command returns after action.
    // 'press key' might return immediately.
    // Let's add a manual delay wrapper or just wait.
    await new Promise(r => setTimeout(r, 3000));

    // 4. Snapshot / Extract
    const snapshot = callSkill('extract');

    // 5. Screenshot
    callSkill('screenshot');

    console.log('\nTest Complete.');
}

runTest();
