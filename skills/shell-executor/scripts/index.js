const { exec } = require('child_process');

const args = JSON.parse(process.argv[2] || '{}');
const { script, cwd } = args;

if (!script) {
    console.error(JSON.stringify({ error: "Missing script argument" }));
    process.exit(1);
}

// Execute
// Using exec for simplicity involving shell features (pipes, etc.)
// For real-time feedback, we'd need to pipe stdout/stderr, but current architecture returns JSON at end.
// We will return the full output.

exec(script, { cwd: cwd || process.cwd(), maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
    if (error) {
        process.stdout.write(JSON.stringify({
            error: error.message,
            stderr: stderr,
            stdout: stdout
        }));
    } else {
        process.stdout.write(JSON.stringify({
            output: stdout,
            stderr: stderr
        }));
    }
});
