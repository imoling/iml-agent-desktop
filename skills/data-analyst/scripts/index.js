const fs = require('fs');
const path = require('path');

// 1. Parse Arguments
const args = JSON.parse(process.argv[2] || '{}');
const { file_path, query } = args;

if (!file_path) {
    process.stdout.write(JSON.stringify({ error: "Missing required argument: file_path" }));
    process.exit(0);
}

const XLSX = require('xlsx');

// 2. Helper Functions
function readData(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const debugLog = (msg) => fs.appendFileSync('/Users/imoling/projects/agents-platform/data-analyst-debug.log', msg + '\n');
    debugLog(`[readData] filePath: ${filePath}, ext: '${ext}', extLen: ${ext.length}, isXlsx: ${ext === '.xlsx'}`);

    if (ext === '.json') {
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);
        return {
            type: 'json',
            total_items: Array.isArray(data) ? data.length : Object.keys(data).length,
            sample: Array.isArray(data) ? data.slice(0, 3) : data,
            raw: content
        };
    } else if (ext === '.csv') {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n').filter(l => l.trim());
        const headers = lines[0].split(',');
        const rows = lines.slice(1).map(line => {
            const values = line.split(',');
            return headers.reduce((obj, header, index) => {
                obj[header.trim()] = values[index]?.trim();
                return obj;
            }, {});
        });
        return {
            type: 'csv',
            total_items: rows.length,
            headers: headers,
            sample: rows.slice(0, 3),
            raw: content.substring(0, 2000)
        };
    } else if (ext === '.xlsx' || ext === '.xls') {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0]; // Default to first sheet
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet);

        let headers = [];
        if (rows.length > 0) {
            headers = Object.keys(rows[0]);
        }

        return {
            type: 'excel',
            total_items: rows.length,
            headers: headers,
            sample: rows.slice(0, 3),
            raw: JSON.stringify(rows.slice(0, 10)) // Provide first 10 rows as raw context context
        };
    }
    throw new Error(`Unsupported file extension: ${ext}`);
}

// 3. Main Logic
(async () => {
    const debugLog = (msg) => fs.appendFileSync('/Users/imoling/projects/agents-platform/data-analyst-debug.log', msg + '\n');
    try {
        debugLog('Script started');
        if (!fs.existsSync(file_path)) {
            throw new Error(`File not found: ${file_path}`);
        }

        debugLog('Reading data...');
        const dataInfo = readData(file_path);
        debugLog(`Data read. Type: ${dataInfo.type}, Items: ${dataInfo.total_items}`);

        // Prepare context for LLM
        const systemPrompt = `You are an expert Data Analyst.
You have been given access to a data file.
File Type: ${dataInfo.type}
Total Items: ${dataInfo.total_items}
Structure/Headers: ${dataInfo.headers ? dataInfo.headers.join(', ') : 'N/A'}
Sample Data: ${JSON.stringify(dataInfo.sample, null, 2)}

Your task is to analyze this data and answer the user's query.

RESPONSE FORMAT:
You must return a JSON object.
{
    "analysis": "Your text analysis here. Use markdown.",
    "chart": { ...ECharts Option Object... } // Optional: Only if user asks for visualization or it helps explanation.
}

For the 'chart' object, provide a valid ECharts 'option' object (JSON).
- Use simple, standard chart types (bar, line, pie, scatter).
- Ensure 'series' has data. You cannot reference external variables.
- You must manually extract relevance data from the 'Sample Data' if sufficient, or inferred patterns. 
- NOTE: If you need to map all data, note that you only see a SAMPLE. If you need to visualize the WHOLE dataset, you should write code to prompt the user to use a plotting library directly. 
- HOWEVER, for this task, just create a chart based on the insights or the sample data provided, or mock representative data if describing a trend. BOLDLY INFER if needed for demonstration.
`;

        const userMessage = query || "Please analyze this dataset, provide a summary, and a visualization if applicable.";

        debugLog('Sending LLM request...');
        // Send request to LLM via Parent Process
        process.send({
            type: 'llm-request',
            id: 'analysis-1',
            payload: {
                systemPrompt: systemPrompt,
                messages: [{ role: 'user', content: userMessage }]
            }
        });

        // Listen for LLM response
        process.on('message', (msg) => {
            if (msg.type === 'llm-response' && msg.id === 'analysis-1') {
                debugLog('Received LLM response');
                debugLog('Raw Content: ' + msg.payload.content.substring(0, 500) + '...'); // Log first 500 chars
                if (msg.payload.error) {
                    process.stdout.write(JSON.stringify({ error: msg.payload.error }));
                } else {
                    try {
                        let content = msg.payload.content;
                        content = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');

                        let result;
                        try {
                            result = JSON.parse(content);
                        } catch (e) {
                            // Fallback if LLM returns plain text
                            result = { analysis: content };
                        }

                        let outputMsg = result.analysis;

                        // Handle Chart Generation
                        if (result.chart) {
                            const chartHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Data Analysis Chart</title>
    <script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
    <style>
        body { margin: 0; padding: 20px; background: #1a1b1e; color: #fff; font-family: sans-serif; }
        #chart { width: 100%; height: 600px; }
    </style>
</head>
<body>
    <h2>Analysis Chart</h2>
    <div id="chart"></div>
    <script>
        var chartDom = document.getElementById('chart');
        var myChart = echarts.init(chartDom, 'dark');
        var option = ${JSON.stringify(result.chart)};
        myChart.setOption(option);
    </script>
</body>
</html>`;
                            const chartPath = path.join(path.dirname(file_path), `chart_${Date.now()}.html`);
                            fs.writeFileSync(chartPath, chartHtml, 'utf-8');
                            outputMsg += `\n\n📊 **Chart Generated**: [View Chart](${chartPath})`;
                        }

                        process.stdout.write(JSON.stringify({
                            output: outputMsg
                        }));

                    } catch (e) {
                        debugLog('Parsing Error: ' + e.message);
                        process.stdout.write(JSON.stringify({ output: msg.payload.content })); // Fallback
                    }
                }
                process.exit(0);
            }
        });

    } catch (error) {
        debugLog('Error: ' + error.message);
        process.stdout.write(JSON.stringify({ error: error.message }));
        process.exit(0);
    }
})();
