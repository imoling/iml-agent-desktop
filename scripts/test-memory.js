const { LocalIndex } = require('vectra');
const path = require('path');
const fs = require('fs');

async function test() {
    const indexPath = '/Users/imoling/Library/Application Support/agents-platform/memory-index';

    console.log('Testing Vectra at path:', indexPath);

    if (!fs.existsSync(path.join(indexPath, 'index.json'))) {
        console.error('Index file not found!');
        return;
    }

    const index = new LocalIndex(indexPath);

    try {
        console.log('Listing items...');
        const items = await index.listItems();
        console.log('Items found:', items.length);
        if (items.length > 0) {
            console.log('First item:', JSON.stringify(items[0].metadata).substring(0, 100));
            console.log('First item timestamp:', new Date(items[0].metadata.timestamp));
        }
    } catch (e) {
        console.error('Error listing items:', e);
    }
}

test();
