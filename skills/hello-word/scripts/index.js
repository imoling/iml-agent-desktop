const fs = require('fs');

// Read input from arguments
const args = JSON.parse(process.argv[2] || '{}');

const name = args.name;

// Validation
if (name === undefined) {
    process.stdout.write(JSON.stringify({ error: "Missing required argument: name" }));
    process.exit(0);
}

try {
    // TODO: Implement your logic here
    console.log('Executing hello-word with', name);
    
    // Simulating work
    const result = "Executed successfully with params: " + JSON.stringify(args);
    
    process.stdout.write(JSON.stringify({ 
        output: result 
    }));
} catch (error) {
    process.stdout.write(JSON.stringify({ 
        error: `Failed to execute: ${error.message}` 
    }));
}
