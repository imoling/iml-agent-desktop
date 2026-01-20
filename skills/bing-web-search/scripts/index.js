const puppeteer = require('puppeteer');

(async () => {
    try {
        const args = JSON.parse(process.argv[2] || '{}');
        const query = args.query;

        if (!query) {
            console.error('Error: Query is required');
            process.exit(1);
        }

        console.log(`Searching Bing for: "${query}"...`);

        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });

        // Wait for results
        try {
            await page.waitForSelector('#b_results', { timeout: 5000 });
        } catch (e) { }

        const results = await page.evaluate(() => {
            const items = [];
            const elements = document.querySelectorAll('li.b_algo');

            elements.forEach(el => {
                const titleEl = el.querySelector('h2 a');
                const linkEl = el.querySelector('h2 a');
                const snippetEl = el.querySelector('.b_caption p') || el.querySelector('.b_snippet');

                if (titleEl && linkEl) {
                    items.push({
                        title: titleEl.innerText,
                        url: linkEl.href,
                        snippet: snippetEl ? snippetEl.innerText : ''
                    });
                }
            });
            return items;
        });

        await browser.close();

        if (results.length === 0) {
            console.log("No results found.");
            return;
        }

        // Format Output
        console.log(`### 🔍 Search Results for "${query}"\n`);

        results.slice(0, 8).forEach(r => {
            console.log(`- **[${r.title}](${r.url})**`);
            if (r.snippet) {
                console.log(`  > ${r.snippet}\n`);
            } else {
                console.log(`\n`);
            }
        });

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
})();
