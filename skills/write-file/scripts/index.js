const fs = require('fs');
const path = require('path');

// Read input from arguments
const args = JSON.parse(process.argv[2] || '{}');
const targetPath = args.path;
const content = args.content;

if (!targetPath) {
    process.stdout.write(JSON.stringify({
        error: "Missing required argument: path"
    }));
    process.exit(0);
}

if (content === undefined) {
    process.stdout.write(JSON.stringify({
        error: "Missing required argument: content"
    }));
    process.exit(0);
}

try {
    // Ensure directory exists
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(targetPath, content, 'utf-8');

    process.stdout.write(JSON.stringify({
        output: `Successfully wrote to ${targetPath}`
    }));
} catch (error) {
    process.stdout.write(JSON.stringify({
        error: `Failed to write file at ${targetPath}: ${error.message}`
    }));
}
