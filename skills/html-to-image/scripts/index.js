const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function run() {
    process.on('message', async (message) => {
        if (message.type === 'start') {
            const { htmlPath, outputPath, width = 800, height = 1200 } = message.payload;

            try {
                // Validate input
                if (!htmlPath) {
                    throw new Error('htmlPath is required');
                }

                // Resolve paths
                const absoluteHtmlPath = path.resolve(htmlPath);

                if (!fs.existsSync(absoluteHtmlPath)) {
                    throw new Error(`HTML file not found: ${absoluteHtmlPath}`);
                }

                // Determine output path
                const finalOutputPath = outputPath
                    ? path.resolve(outputPath)
                    : absoluteHtmlPath.replace(/\.html$/i, '.png');

                // Launch headless browser
                const browser = await puppeteer.launch({
                    headless: 'new',
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage'
                    ]
                });

                const page = await browser.newPage();

                // Set viewport
                await page.setViewport({
                    width: parseInt(width) || 800,
                    height: parseInt(height) || 1200
                });

                // Load HTML file
                await page.goto(`file://${absoluteHtmlPath}`, {
                    waitUntil: 'networkidle0',
                    timeout: 30000
                });

                // Wait a bit for any animations/fonts to load
                await new Promise(resolve => setTimeout(resolve, 500));

                // Take screenshot
                await page.screenshot({
                    path: finalOutputPath,
                    fullPage: true,
                    type: 'png'
                });

                await browser.close();

                console.log(`Successfully converted HTML to image: ${finalOutputPath}`);
                process.exit(0);

            } catch (error) {
                console.error(`Error: ${error.message}`);
                process.exit(1);
            }
        }
    });
}

run();
