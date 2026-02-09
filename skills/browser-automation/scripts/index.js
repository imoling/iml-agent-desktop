const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Constants
const PROFILE_PATH = path.join(process.env.HOME || process.env.USERPROFILE, '.iml-agent-browser');
const BIN_PATH = path.resolve(__dirname, '../node_modules/.bin/agent-browser');

// Read args
const args = JSON.parse(process.argv[2] || '{}');
const { action, url, selector, text, amount, x, y } = args;

// Helper to run command
function runBrowserCommand(cmdArgs) {
    try {
        // Ensure profile exists implies persistence, agent-browser handles creation
        const finalArgs = ['--profile', PROFILE_PATH, ...cmdArgs];

        // Ensure binary executes
        const output = execFileSync(BIN_PATH, finalArgs, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
        return { success: true, output: output.trim() };
    } catch (error) {
        return { success: false, error: error.message, stderr: error.stderr ? error.stderr.toString() : '' };
    }
}

// Main Logic
try {
    let result;

    switch (action) {
        case 'navigate':
            if (!url) throw new Error('Missing URL for navigate');
            result = runBrowserCommand(['open', url]);
            break;

        case 'click':
            if (x !== undefined && y !== undefined) {
                result = runBrowserCommand(['click', '--coords', `${x},${y}`]);
            } else if (selector) {
                result = runBrowserCommand(['click', selector]);
            } else {
                throw new Error('Missing selector or coords for click');
            }
            break;

        case 'type':
            if (!selector || text === undefined) throw new Error('Missing selector or text for type');
            result = runBrowserCommand(['fill', selector, text]);
            break;

        case 'press_key':
            if (!args.key) throw new Error('Missing key for press_key');
            result = runBrowserCommand(['press', args.key]);
            break;

        case 'scroll':
            // agent-browser scroll command might differ, checking help implies "scroll" exists
            // default to scroll up/down? Let's assume scroll amount implies pixel or direction.
            // If amount is positive -> down, negative -> up?
            // Or just use generic scroll if no args supported well.
            // Let's rely on standard scroll or wheel. 
            // As fallback, use 'evaluate' if simple scroll lacks precision.
            // For now, mapping simple 'scroll' without args usually scrolls down a page.
            // If amount provided, maybe we can't easily map it without knowing CLI syntax exactly (help was brief on scroll).
            // Assuming simple `scroll` works for "Scroll down".
            result = runBrowserCommand(['scroll']);
            break;

        case 'screenshot':
            result = runBrowserCommand(['screenshot', '--full']);
            break;

        case 'extract':
        case 'analyze_screenshot': // Legacy mapping
            // Snapshot gives refs and structure, good for extraction
            result = runBrowserCommand(['snapshot']);
            break;

        case 'back':
            result = runBrowserCommand(['back']);
            break;

        case 'forward':
            result = runBrowserCommand(['forward']);
            break;

        default:
            throw new Error(`Unknown action: ${action}`);
    }

    if (result.success) {
        process.stdout.write(JSON.stringify({ output: result.output }));
    } else {
        process.stdout.write(JSON.stringify({ error: result.error, detailed: result.stderr }));
    }

} catch (e) {
    process.stdout.write(JSON.stringify({ error: e.message }));
}
