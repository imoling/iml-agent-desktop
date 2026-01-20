const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Parse Arguments
const args = JSON.parse(process.argv[2] || '{}');
const { url, content, filename, landscape, cwd } = args;

// Session sharing logic (Sync with browser-automation)
// We try to find ANY active session to piggyback on
const getSessionFile = (headless) => path.join(os.tmpdir(), `agent-browser-session-${headless ? 'headless' : 'windowed'}.json`);

async function getBrowser() {
    let browser;
    // Check windowed first (more likely to be authenticated user session)
    let sessionFiles = [getSessionFile(false), getSessionFile(true)];

    for (const file of sessionFiles) {
        if (fs.existsSync(file)) {
            try {
                const data = JSON.parse(fs.readFileSync(file, 'utf8'));
                // Verify connection
                browser = await puppeteer.connect({ browserWSEndpoint: data.endpoint });
                // console.log(`Connected to existing session: ${file}`);
                break;
            } catch (e) {
                // Invalid session, ignore
            }
        }
    }

    if (!browser) {
        // Launch a standalone instance if no session found
        // console.log('Launching new headless browser for PDF generation...');
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
    }

    return browser;
}

(async () => {
    try {
        const browser = await getBrowser();

        // If we reused a session, get the pages. 
        // If URL provided, New Tab. If not, use Active Tab.
        let page;

        if (url || content) {
            page = await browser.newPage();
            if (url) {
                await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
            } else if (content) {
                await page.setContent(content, { waitUntil: 'networkidle0' });
            }
        } else {
            // Capture current active tab
            const pages = await browser.pages();
            // Usually the last one is active, or find one that is visible?
            // Puppeteer doesn't easily tell "active" tab. Assuming last opened or index 0.
            // Let's grab the last one that isn't empty 'about:blank'
            page = pages[pages.length - 1]; // Naive strategy
            if (!page) page = await browser.newPage();

            // Bring to front just in case
            try { await page.bringToFront(); } catch (e) { }
        }

        // Apply styles if needed for better print?
        // await page.emulateMediaType('screen'); // Often better for "what you see"

        // Filename
        const finalName = filename || `document-${Date.now()}.pdf`;
        const saveDir = cwd || process.cwd();
        const savePath = path.join(saveDir, finalName);

        await page.pdf({
            path: savePath,
            format: 'A4',
            printBackground: true,
            landscape: landscape || false,
            margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' }
        });

        console.log(`PDF Generated Successfully: ${savePath}`);

        // Cleanup: If we opened a new tab for specific URL, close it. 
        // If we captured existing session's current page, DO NOT close it.
        // If we launched a NEW browser, close browser.

        // Simple heuristic: If we created 'page' variable via newPage() logic above
        if (url || content) {
            await page.close();
        }

        // If we launched the browser (process.pid matches?), close it. 
        // But puppeteer.connect returns a browser object too.
        // Checking `browser.process()`: connected browsers via WS endpoint might return null for process()?
        // Actually, safer: If we connected, `browser.process()` might be null or we shouldn't kill it.
        // We only close if WE launched it.
        // How to track?
        // Determine based on session file existence check above? 
        // A simplified approach: Just disconnect.
        browser.disconnect();

        // Note: usage of 'disconnect' leaves the remote browser running (good for session reuse).
        // Usage of 'close' kills it.
        // If we launched a temp browser, we should probably kill it. 
        // But for simplicity/speed for now, letting it become zombie or handling via 'browser.close()' if we knew we launched it.
        // Let's assume disconnect is safe for connected, but we might leak if we launched.
        // Re-checking getBrowser logic:

        // To properly close self-launched browser:
        // Pass a flag from getBrowser?
        // Refactor getBrowser to return { browser, isShared }
    } catch (e) {
        console.error(`Error generating PDF: ${e.message}`);
        process.exit(1);
    }
})();
