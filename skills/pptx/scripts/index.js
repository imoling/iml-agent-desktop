const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

async function runPythonScript(scriptName, args) {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, scriptName);
        const pythonProcess = spawn('python3', [scriptPath, ...args]);

        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Python script failed with code ${code}: ${stderr}`));
            } else {
                resolve(stdout);
            }
        });
    });
}

// Minimal wrapper for html2pptx if dependencies exist
async function createPptx(htmlFile, outputFile) {
    try {
        const pptxgen = require('pptxgenjs');
        const html2pptx = require('./html2pptx');

        const pptx = new pptxgen();
        pptx.layout = 'LAYOUT_16x9';

        await html2pptx(htmlFile, pptx);

        await pptx.writeFile({ fileName: outputFile });
        return `Successfully created ${outputFile}`;
    } catch (e) {
        if (e.code === 'MODULE_NOT_FOUND') {
            throw new Error("Missing dependencies (pptxgenjs, playwright, sharp). Please install them in the project root.");
        }
        throw e;
    }
}

module.exports = async function (params) {
    const { action, file_path, output_path } = params;

    if (action === 'analyze') {
        if (!output_path) throw new Error("output_path is required for analyze");
        const result = await runPythonScript('inventory.py', [file_path, output_path]);
        return result || `Analysis saved to ${output_path}`;
    }
    else if (action === 'create') {
        if (!output_path) throw new Error("output_path is required for create");
        return await createPptx(file_path, output_path);
    }

    throw new Error(`Unknown action: ${action}`);
};