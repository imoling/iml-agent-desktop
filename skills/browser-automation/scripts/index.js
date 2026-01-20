const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Session file function to separate headless and windowed sessions
const getSessionFile = (headless) => path.join(os.tmpdir(), `agent-browser-session-${headless ? 'headless' : 'windowed'}.json`);

async function getBrowser(headless = false) {
    let browser;
    let endpoint;
    const sessionFile = getSessionFile(headless);

    // Try to recover existing session
    if (fs.existsSync(sessionFile)) {
        try {
            const data = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
            endpoint = data.endpoint;
            // Validate if valid
            try {
                browser = await puppeteer.connect({ browserWSEndpoint: endpoint });
                // console.log('Connected to existing browser session.');
            } catch (e) {
                // console.log('Existing session invalid, will launch new one.');
                endpoint = null;
            }
        } catch (e) {
            // Ignore parse errors
        }
    }

    if (!browser) {
        // console.log('Launching new browser...');

        const launchArgs = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--window-size=1280,800'
        ];

        // App mode only makes sense in GUI mode
        if (headless !== true) {
            launchArgs.push('--app=data:text/html,<html><body><h1 style="font-family:sans-serif;text-align:center;margin-top:20%">Agent Browser Starting...</h1></body></html>');
        }

        // Launch new browser
        browser = await puppeteer.launch({
            // Default to non-headless for now so user can see it works
            headless: headless === true ? 'new' : false,
            // Add args to make it work in more environments
            args: launchArgs,
            // Critical: Do not kill browser when this script exits
            handleSIGINT: false,
            handleSIGTERM: false,
            handleSIGHUP: false,
            detached: true // Start process in detached mode if possible (though Puppeteer manages this)
        });

        // Critical: Unref the browser process to allow it to run independently
        if (browser.process()) {
            browser.process().unref();
        }

        // Save endpoint
        const wsEndpoint = browser.wsEndpoint();
        fs.writeFileSync(sessionFile, JSON.stringify({ endpoint: wsEndpoint, pid: browser.process().pid }));
    }

    return browser;
}

function askLLM(prompt, imageBase64) {
    return new Promise((resolve, reject) => {
        const id = Math.random().toString(36).substring(7);

        const handler = (message) => {
            if (message.type === 'llm-response' && message.id === id) {
                process.removeListener('message', handler);
                if (message.payload.error) {
                    reject(new Error(message.payload.error));
                } else {
                    // payload.content is LLMResponse object
                    resolve(message.payload.content.content || '');
                }
            }
        };

        process.on('message', handler);

        const content = [];
        if (imageBase64) {
            content.push({ type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } });
        }
        content.push({ type: 'text', text: prompt });

        process.send({
            type: 'llm-request',
            id,
            payload: {
                messages: [{ role: 'user', content }],
                systemPrompt: `You are a browser automation assistant. Analyze the screenshot and provide the requested information. 
IMPORTANT: If the user asks about login or forms:
1. Explicitly confirm if a login form is visible.
2. If yes, directly identify the VISUAL LOCATION (e.g., "center", "top-right") or approximate COORDINATES for the 'username' and 'password' fields.
3. specificy if there are any CAPTCHAs or security checks.`
            }
        });
    });
}

async function run() {
    // Parse arguments
    // Expected args: { action, url, selector, text, headless }
    // In this platform, args are passed differently depending on the runtime.
    // Assuming standard node script where we might parse process.argv or input via stdin/env?
    // BUT checking how other skills work: LLMService passes args as object to executeSkill.
    // The "SkillExecutor" (Node) usually passes args via... wait.
    // Looking at "read-file/scripts/index.js", it seems it might be using a wrapper or we need to respect how `SkillManager` invokes it.
    // `SkillManager.ts` forks the child. It sends arguments via `child.send({ type: 'start', payload: args })`.
    // So we need to listen for message.

    // HOWEVER, `LLMService` & `SkillManager` seem to have evolved. Let's look at `system-operator`.
    // It has `const args = ...`? No, usually standard Node IPC.

    // Let's implement the standard listener pattern used in this project.

    process.on('message', async (message) => {
        if (message.type === 'start') {
            const { action, url, selector, text, headless, key, amount, instruction, x, y } = message.payload;

            // Resolve actual headless state
            const isHeadless = headless === true;

            try {
                const browser = await getBrowser(isHeadless);

                // Get pages
                const pages = await browser.pages();
                // Use the first page or open new if none (unlikely)
                let page = pages.length > 0 ? pages[0] : await browser.newPage();

                // Ensure viewport is reasonable
                await page.setViewport({ width: 1280, height: 800 });

                // Bring tab to front to ensure it's the one user sees
                try {
                    await page.bringToFront();
                } catch (e) {
                    // Ignore if fails (e.g. headless)
                }

                const pageTitle = await page.title();
                // console.log(`Active Page: ${pageTitle}`);

                let result = '';

                switch (action) {
                    case 'launch':
                        result = 'Browser launched successfully.';
                        break;

                    case 'login':
                        const { username, password } = message.payload;
                        if (!url) throw new Error('URL is required for login.');
                        // Check if memory provided credentials

                        try { await page.bringToFront(); } catch (e) { }
                        await page.goto(url, { waitUntil: 'domcontentloaded' });

                        // 1. Check if login is needed (Are there password fields?)
                        // Wait briefly for content to render
                        try { await page.waitForSelector('body', { timeout: 5000 }); } catch (e) { }

                        const passwordField = await page.$('input[type="password"]');
                        if (!passwordField) {
                            result = `Page loaded. No password field detected - you might already be logged in. (Title: ${await page.title()})`;
                        } else {
                            if (!username || !password) {
                                // Password field exists but no creds provided
                                throw new Error('Login page detected but no credentials provided. Please check memory or ask user.');
                            }

                            // 2. Attempt to fill
                            // Heuristic for username: look for input before the password field or common names
                            const userField = await page.$('input[type="email"], input[name*="user"], input[name*="login"], input[placeholder*="user"], input[placeholder*="mail"], input[type="text"]');

                            if (userField) {
                                await userField.type(username);
                                await passwordField.type(password);

                                // 3. Submit
                                // Try enter key on password field first (most robust)
                                await passwordField.press('Enter');

                                // Wait for navigation or state change
                                try {
                                    await page.waitForNavigation({ timeout: 5000 });
                                } catch (e) {
                                    // Navigation timeout is common for SPA logins, continue to check state
                                }

                                // 4. Post-Login Verification
                                // Check if password field is still visible
                                const remainingPasswordField = await page.$('input[type="password"]');
                                const currentTitle = await page.title();

                                if (!remainingPasswordField) {
                                    result = `Login submitted. Login form NO LONGER DETECTED (Success likely). New Title: ${currentTitle}`;
                                } else {
                                    result = `Login submitted but password field IS STILL VISIBLE (Possible failure or CAPTCHA). Current Title: ${currentTitle}. Please check the screenshot.`;
                                }
                            } else {
                                throw new Error('Could not automatically identify username field. Please login manually.');
                            }
                        }
                        break;

                    case 'navigate':
                        try { await page.bringToFront(); } catch (e) { }
                        if (!url) throw new Error('URL is required for navigate action.');
                        await page.goto(url, { waitUntil: 'domcontentloaded' });
                        result = `Navigated to ${url} (Title: ${await page.title()})`;
                        break;

                    case 'click':
                        try { await page.bringToFront(); } catch (e) { }
                        if (!selector) throw new Error('Selector is required for click action.');

                        try {
                            // 1. Standard click attempt
                            await page.waitForSelector(selector, { timeout: 5000 });
                            await page.click(selector);
                            result = `Clicked element: ${selector} on page "${await page.title()}"`;
                        } catch (clickError) {
                            // 2. Smart Fallback: Check for href
                            // console.log(`Standard click failed for ${selector}, attempting fallback navigation...`);

                            // Puppeteer evaluation to find href on element or closest parent anchor
                            const absoluteUrl = await page.evaluate((sel) => {
                                const el = document.querySelector(sel);
                                if (!el) return null;
                                const anchor = el.closest('a');
                                return anchor ? anchor.href : null;
                            }, selector).catch(() => null);

                            if (absoluteUrl && (absoluteUrl.startsWith('http') || absoluteUrl.startsWith('file'))) {
                                await page.goto(absoluteUrl, { waitUntil: 'domcontentloaded' });
                                result = `[Fallback] Click failed, navigated to link: ${absoluteUrl}`;
                            } else {
                                // No link found, re-throw original error
                                throw clickError;
                            }
                        }
                        break;

                    case 'type':
                        try { await page.bringToFront(); } catch (e) { }
                        if (!selector || !text) throw new Error('Selector and text are required for type action.');
                        await page.waitForSelector(selector, { timeout: 5000 });
                        await page.type(selector, text);
                        result = `Typed text into ${selector}`;
                        break;

                    case 'extract':
                        try { await page.bringToFront(); } catch (e) { }
                        if (!selector) {
                            // Extract full body text if no selector
                            const content = await page.evaluate(() => document.body.innerText);
                            result = content;
                        } else {
                            await page.waitForSelector(selector, { timeout: 5000 });
                            const content = await page.$eval(selector, el => el.innerText);
                            result = content;
                        }
                        break;

                    case 'scroll':
                        try { await page.bringToFront(); } catch (e) { }
                        const scrollAmount = amount || 500;
                        await page.evaluate((y) => window.scrollBy(0, y), scrollAmount);
                        result = `Scrolled by ${scrollAmount} pixels (Current Y: ${await page.evaluate(() => window.scrollY)})`;
                        break;

                    case 'press_key':
                        try { await page.bringToFront(); } catch (e) { }
                        if (!key) throw new Error('Key is required for press_key action.');
                        await page.keyboard.press(key);
                        result = `Pressed key: ${key}`;
                        break;

                    case 'go_back':
                        try { await page.bringToFront(); } catch (e) { }
                        await page.goBack({ waitUntil: 'domcontentloaded' });
                        result = `Navigated back (Title: ${await page.title()})`;
                        break;

                    case 'go_forward':
                        try { await page.bringToFront(); } catch (e) { }
                        await page.goForward({ waitUntil: 'domcontentloaded' });
                        result = `Navigated forward (Title: ${await page.title()})`;
                        break;

                    case 'screenshot':
                        const filename = `screenshot-${Date.now()}.png`;
                        // Determine save path. Ideally in a downloads folder or workspace.
                        // For now, let's put it in the CWD if passed, or temp.
                        // The 'payload' might handle cwd?
                        const savePath = path.join(message.cwd || process.cwd(), filename);
                        await page.screenshot({ path: savePath });
                        result = `Screenshot saved to ${savePath}`;

                        // Signal execution environment about the artifact
                        // (If supported, but plain text result works too)
                        break;

                    case 'close':
                        await browser.close();
                        // Close specific session file
                        const sessionFile = getSessionFile(isHeadless);
                        if (fs.existsSync(sessionFile)) fs.unlinkSync(sessionFile);
                        result = 'Browser session closed.';
                        break;

                    case 'analyze_screenshot':
                        const b64 = await page.screenshot({ encoding: 'base64' });
                        const query = instruction || 'Describe what is on this page.';
                        try {
                            result = await askLLM(query, b64);
                        } catch (err) {
                            result = `Error analyzing screenshot: ${err.message}. (Hint: The current AI model might not support image input. Try using 'extract' action to read text instead.)`;
                        }
                        break;

                    case 'click_coordinates':
                        try { await page.bringToFront(); } catch (e) { }
                        if (x === undefined || y === undefined) throw new Error('X and Y coordinates are required for click_coordinates.');
                        await page.mouse.click(x, y);
                        result = `Clicked at coordinates (${x}, ${y})`;
                        break;

                    default:
                        throw new Error(`Unknown action: ${action}`);
                }

                // Output final result to stdout so SkillManager captures it
                // We use console.log which appends newline, or stdout.write.
                // SkillManager trims whitespace.
                console.log(result);

                // Also send progress event just in case UI uses it for intermediate feedback
                // process.send({ type: 'progress', payload: result }); 

                // Important: Don't exit process if we want to keep it alive? 
                // No, the SkillManager expects the script to exit or at least send result.
                // Since user might want to disconnect but keep browser running (daemon mode), 
                // we explicitly disconnect here if not closing.
                if (action !== 'close') {
                    browser.disconnect();
                }

                // We are done with THIS interaction.

                // Aggressively remove listeners that might trigger child process cleanup
                process.removeAllListeners('exit');
                process.removeAllListeners('SIGINT');
                process.removeAllListeners('SIGTERM');
                process.removeAllListeners('SIGHUP');

                process.exit(0);

            } catch (error) {
                // Use stderr so SkillManager captures the actual error message
                console.error(`Error: ${error.message}`);
                process.exit(1);
            }
        }
    });
}

run();
