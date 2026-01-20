const fs = require('fs');

// Read input from arguments
const args = JSON.parse(process.argv[2] || '{}');
const targetPath = args.path;

if (!targetPath) {
    process.stdout.write(JSON.stringify({
        error: "Missing required argument: path"
    }));
    process.exit(0);
}

try {
    const content = fs.readFileSync(targetPath, 'utf-8');

    process.stdout.write(JSON.stringify({
        output: content
    }));
} catch (error) {
    process.stdout.write(JSON.stringify({
        error: `Failed to read file at ${targetPath}: ${error.message}`
    }));
}
