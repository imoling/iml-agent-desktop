const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// 1. Parse Arguments
const args = JSON.parse(process.argv[2] || '{}');
const { input_path, output_path, sheet_name } = args;

if (!input_path) {
    process.stdout.write(JSON.stringify({ error: "Missing required argument: input_path" }));
    process.exit(0);
}

// 2. Main Logic
(async () => {
    try {
        if (!fs.existsSync(input_path)) {
            throw new Error(`Input file not found: ${input_path}`);
        }

        // Read the workbook
        const workbook = XLSX.readFile(input_path);

        let targetSheet;
        if (sheet_name) {
            if (!workbook.Sheets[sheet_name]) {
                throw new Error(`Sheet "${sheet_name}" not found in workbook. Available sheets: ${workbook.SheetNames.join(', ')}`);
            }
            targetSheet = workbook.Sheets[sheet_name];
        } else {
            // Default to first sheet
            targetSheet = workbook.Sheets[workbook.SheetNames[0]];
        }

        // Convert to CSV
        const csvContent = XLSX.utils.sheet_to_csv(targetSheet);

        // Determine output path
        let finalOutputPath = output_path;
        if (!finalOutputPath) {
            const parsedPath = path.parse(input_path);
            finalOutputPath = path.join(parsedPath.dir, `${parsedPath.name}.csv`);
        }

        // Write to file
        fs.writeFileSync(finalOutputPath, csvContent, 'utf-8');

        process.stdout.write(JSON.stringify({
            output: `Successfully converted "${input_path}" to "${finalOutputPath}"`,
            output_file: finalOutputPath
        }));
        process.exit(0);

    } catch (error) {
        process.stdout.write(JSON.stringify({ error: error.message }));
        process.exit(0);
    }
})();
