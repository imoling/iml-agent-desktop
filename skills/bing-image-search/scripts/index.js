const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

function openFile(filePath) {
    const cmd = process.platform === 'darwin' ? `open "${filePath}"` : `start "" "${filePath}"`;
    exec(cmd);
}

(async () => {
    try {
        const args = JSON.parse(process.argv[2] || '{}');
        const query = args.query;
        const count = args.count || 20;

        if (!query) {
            console.error('Error: Query is required');
            process.exit(1);
        }

        console.log(`Searching Bing Images for: "${query}"...`);

        const browser = await puppeteer.launch({
            headless: 'new', // New headless mode
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        // Mock User Agent
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        const searchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&first=1&scenario=ImageBasicHover`;
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });

        // Scroll to load reasonable amount of images
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 100;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if (totalHeight >= scrollHeight || totalHeight > 3000) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 50);
            });
        });

        // Extract Images
        const images = await page.evaluate(() => {
            const results = [];
            // Bing typically uses .mimg or .iusc (JSON in attribute)
            const elements = document.querySelectorAll('.iusc');

            elements.forEach(el => {
                try {
                    const m = JSON.parse(el.getAttribute('m'));
                    if (m && m.murl) { // murl = media url (full size), turl = thumbnail url
                        results.push({
                            url: m.murl, // Prefer full size
                            thumb: m.turl,
                            title: m.t || 'Image'
                        });
                    }
                } catch (e) { }
            });
            return results;
        });

        await browser.close();

        // Slice to limit
        const finalImages = images.slice(0, count);

        if (finalImages.length === 0) {
            console.log('No images found.');
            return;
        }

        console.log(`Found ${finalImages.length} images. Generating gallery...`);

        // Generate HTML Gallery
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${query} - Bing Image Search</title>
    <style>
        body { margin: 0; padding: 20px; font-family: system-ui, -apple-system, sans-serif; background: #111; color: #fff; }
        h1 { text-align: center; margin-bottom: 30px; font-weight: 300; }
        .gallery {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 16px;
        }
        .item {
            break-inside: avoid;
            margin-bottom: 16px;
            position: relative;
            border-radius: 8px;
            overflow: hidden;
            background: #222;
            transition: transform 0.2s;
            cursor: pointer;
        }
        .item:hover { transform: scale(1.02); z-index: 10; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        .item img {
            width: 100%;
            height: auto;
            display: block;
            object-fit: cover;
        }
        .info {
            padding: 10px;
            font-size: 12px;
            color: #ccc;
            background: rgba(0,0,0,0.8);
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            transform: translateY(100%);
            transition: transform 0.2s;
        }
        .item:hover .info { transform: translateY(0); }
    </style>
</head>
<body>
    <h1>${query}</h1>
    <div class="gallery">
        ${finalImages.map(img => `
            <div class="item" onclick="window.open('${img.url}', '_blank')">
                <img src="${img.thumb}" alt="${img.title.replace(/"/g, '&quot;')}" loading="lazy">
                <div class="info">${img.title}</div>
            </div>
        `).join('')}
    </div>
</body>
</html>`;

        const homeDir = process.env.HOME || process.env.USERPROFILE;
        const desktopDir = path.join(homeDir, 'Desktop');
        const filename = `BingImages_${query.replace(/[^a-z0-9]/gi, '_').slice(0, 20)}_${Date.now()}.html`;
        const filePath = path.join(desktopDir, filename);

        fs.writeFileSync(filePath, html);
        console.log(`Gallery saved to Desktop: ${filename}`);
        // openFile(filePath); // Disable auto-open to respect user preference for background execution

        // Return a markdown link for the chat
        console.log(`[GALLERY](${filePath})`);

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
})();
