const fs = require('fs');
const path = require('path');

// Read input from arguments (passed by SkillManager)
const args = JSON.parse(process.argv[2] || '{}');
const targetPath = args.path || process.cwd();

try {
    const items = fs.readdirSync(targetPath, { withFileTypes: true });

    const result = items.map(item => ({
        name: item.name,
        type: item.isDirectory() ? 'directory' : 'file',
        path: path.join(targetPath, item.name)
    }));

    process.stdout.write(JSON.stringify({
        output: JSON.stringify(result, null, 2)
    }));
} catch (error) {
    process.stdout.write(JSON.stringify({
        error: `Failed to list files at ${targetPath}: ${error.message}`
    }));
}
