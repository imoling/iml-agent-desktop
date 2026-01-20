const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');

// 1. Parse Arguments
const args = JSON.parse(process.argv[2] || '{}');
const { action, target_path, strategy, app_name, app_action, dry_run } = args;

// Helper: Run Shell Command
function runCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) reject(error);
            else resolve(stdout.trim());
        });
    });
}

// Categories Definition
const EXT_MAP = {
    'Images': ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.heic'],
    'Documents': ['.pdf', '.doc', '.docx', '.txt', '.md', '.csv', '.xlsx', '.xls', '.ppt', '.pptx', '.key', '.pages'],
    'Archives': ['.zip', '.rar', '.7z', '.tar', '.gz'],
    'Video': ['.mp4', '.mov', '.avi', '.mkv'],
    'Audio': ['.mp3', '.wav', '.aac', '.m4a'],
    'Code': ['.js', '.ts', '.py', '.java', '.html', '.css', '.json', '.vue', '.c', '.cpp', '.h', '.sh'],
    'Installers': ['.dmg', '.pkg', '.iso']
};

function getCategory(file) {
    const ext = path.extname(file).toLowerCase();
    for (const [category, exts] of Object.entries(EXT_MAP)) {
        if (exts.includes(ext)) return category;
    }
    return 'Others';
}

function getDesktopPath() {
    return path.join(os.homedir(), 'Desktop');
}

// Action: Analyze Files (Scan & Report)
async function analyzeFiles() {
    // ... (Analysis logic remains same, but we make sure to return rich data)
    // For brevity, using the same logic as before but ensuring robust stats
    const dir = target_path || getDesktopPath();
    if (!fs.existsSync(dir)) throw new Error(`Directory not found: ${dir}`);

    const items = fs.readdirSync(dir);
    const stats = {
        total_items: items.length,
        categories: {},
        screenshots: 0,
        code_projects: 0,
        empty_folders: 0,
        by_year: {}, // For time-based strategy
        clutter_score: 'Low'
    };

    // Initialize counts
    Object.keys(EXT_MAP).forEach(k => stats.categories[k] = 0);
    stats.categories['Others'] = 0;
    stats.categories['Folders'] = 0;

    for (const item of items) {
        if (item === '.DS_Store' || item === '.localized') continue;
        const fullPath = path.join(dir, item);
        let stat;
        try { stat = fs.statSync(fullPath); } catch (e) { continue; }

        if (stat.isDirectory()) {
            stats.categories['Folders']++;
            try {
                const subItems = fs.readdirSync(fullPath);
                if (subItems.length === 0) stats.empty_folders++;
                else if (subItems.some(i => ['package.json', 'go.mod', 'pom.xml', '.git'].includes(i))) stats.code_projects++;
            } catch (e) { }
        } else {
            const cat = getCategory(item);
            stats.categories[cat]++;
            if (item.toLowerCase().startsWith('screenshot') || item.includes('截屏')) stats.screenshots++;

            // Time Stats
            const year = stat.birthtime.getFullYear();
            stats.by_year[year] = (stats.by_year[year] || 0) + 1;
        }
    }

    // Calc Clutter Score
    if (items.length > 50 || stats.screenshots > 10) stats.clutter_score = 'High';
    else if (items.length > 20) stats.clutter_score = 'Medium';

    return {
        path: dir,
        analysis: stats,
        message: `Found ${stats.total_items} items. Detected ${stats.screenshots} screenshots.`
    };
}

// Action: Generate Plan / Organize Files
async function organizeFiles() {
    const dir = target_path || getDesktopPath();
    if (!fs.existsSync(dir)) throw new Error(`Directory not found: ${dir}`);

    const items = fs.readdirSync(dir);
    const plan = [];

    // Strategies
    // 'smart_cleanup': Screenshots, Projects, Categories
    // 'by_extension': Simple category map
    // 'by_date': Year/Month folders
    const useStrategy = strategy || 'smart_cleanup';

    for (const item of items) {
        if (item.startsWith('.')) continue; // Ignore hidden
        // Skip existing organized folders if they match our targets
        if (['Screenshots', 'Projects', 'Documents', 'Images', 'Archives', 'Video', 'Audio', 'Code', 'Installers', 'Others'].includes(item) && fs.statSync(path.join(dir, item)).isDirectory()) continue;
        // Skip Year folders if using by_date? Hard to detect generic years.

        const fullPath = path.join(dir, item);
        let stat;
        try { stat = fs.statSync(fullPath); } catch (e) { continue; }

        let targetFolder = null;

        if (useStrategy === 'by_date') {
            const date = stat.birthtime;
            const year = date.getFullYear();
            // const month = String(date.getMonth() + 1).padStart(2, '0');
            targetFolder = `${year}_Files`;
        } else if (useStrategy === 'smart_cleanup') {
            if (stat.isDirectory()) {
                const sub = fs.readdirSync(fullPath);
                if (sub.length === 0) continue; // Skip empty, handle separately?
                if (sub.some(i => ['package.json', '.git'].includes(i))) targetFolder = 'Projects';
            } else {
                if (item.toLowerCase().startsWith('screenshot') || item.includes('截屏')) targetFolder = 'Screenshots';
                else targetFolder = getCategory(item);
            }
        } else if (useStrategy === 'by_content_theme') {
            // Simple Clustering Strategy based on filename keywords
            // 1. Tokenize filename
            const name = path.basename(item, path.extname(item)).toLowerCase().replace(/[-_.]/g, ' ');
            const tokens = name.split(' ').filter(t => t.length > 3 && !/^\d+$/.test(t));

            // Heuristic: If token appears in multiple files, it's a theme.
            // (Note: In a real "scan first" approach, we would have built a frequency map in analyzeFiles.
            //  Here we might need a preliminary pass if we want strict clustering. 
            //  For now, let's assume we use a "top keywords" approach if provided, or fallback to Extension.)

            // Allow user to pass "keywords" in args? Or just use Category as fallback.
            // Let's rely on `analyzeFiles` to return "suggested_themes" which the user might pick?
            // Actually, let's implement a simple "Project" detector.

            if (item.toLowerCase().includes('project') || item.toLowerCase().includes('demo')) {
                targetFolder = 'Projects';
            } else if (item.toLowerCase().includes('report') || item.toLowerCase().includes('draft')) {
                targetFolder = 'Documents';
            } else {
                targetFolder = getCategory(item);
            }
        } else {
            // Default by_extension logic
            targetFolder = getCategory(item);
        }

        if (targetFolder) {
            plan.push({
                file: item,
                source: fullPath,
                destDir: path.join(dir, targetFolder),
                dest: path.join(dir, targetFolder, item),
                category: targetFolder
            });
        }
    }

    // If dry_run is true OR strategy is 'manual_plan', we return the PLAN.
    // The Agent should ask for 'manual_plan' first usually.
    if (dry_run) {
        const scriptLines = [];
        scriptLines.push(`# Cleanup Plan for ${dir}`);
        scriptLines.push(`# Strategy: ${useStrategy}`);

        // Generate pseudo-shell script for display
        const folders = [...new Set(plan.map(p => p.destDir))];
        folders.forEach(f => scriptLines.push(`mkdir -p "${f}"`));
        plan.forEach(p => scriptLines.push(`mv "${p.source}" "${p.dest}"`));

        return {
            status: 'plan_ready',
            total_moves: plan.length,
            strategy: useStrategy,
            script: scriptLines.join('\n'), // structured for UI to display if needed
            message: `Plan generated. moving ${plan.length} files.`
        };
    }

    // Execute in Batch
    // To solve "Auto-execution limit", we perform the moves HERE in node.js.
    // To solve "Fake Death" (Unresponsiveness), we use async operations and yield to event loop.
    const moved = [];
    const errors = [];

    // Process in chunks to allow event loop to breathe (and send IPC messages)
    const CHUNK_SIZE = 10;

    for (let i = 0; i < plan.length; i += CHUNK_SIZE) {
        const chunk = plan.slice(i, i + CHUNK_SIZE);

        // Report Progress
        if (process.send) {
            process.send({
                type: 'progress',
                payload: `Moving files... (${i}/${plan.length})`
            });
        }

        // Use Promise.all for parallel operations within chunk (safe for file moves usually)
        await Promise.all(chunk.map(async (p) => {
            try {
                // Ensure dest dir exists (cache existing checks if optimizing further, but fs.promises is fast enough)
                await fs.promises.mkdir(p.destDir, { recursive: true });

                // Check if dest exists to avoid overwrite (unless strategy implies logic, here we skip)
                try {
                    await fs.promises.access(p.dest);
                    // Dest exists, skip
                } catch {
                    // Dest does not exist, move
                    await fs.promises.rename(p.source, p.dest);
                    moved.push(p.file);
                }
            } catch (err) {
                errors.push(`${p.file}: ${err.message}`);
            }
        }));

        // Yield to event loop to allow IPC messages to flush
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    // Final report
    if (process.send) {
        process.send({
            type: 'progress',
            payload: `Finalizing...`
        });
    }

    return {
        status: 'success',
        moved_count: moved.length,
        errors: errors,
        message: `Successfully batch moved ${moved.length} items.`
    };
}

// Action: Control App
async function controlApp() {
    if (!app_name) throw new Error("Missing app_name for control_app");
    const safeAppName = app_name.replace(/"/g, '\\"'); // Sanitize quote

    let script = '';
    if (app_action === 'open') {
        script = `tell application "${safeAppName}" to activate`;
    } else if (app_action === 'close') {
        script = `tell application "${safeAppName}" to quit`;
    } else {
        throw new Error(`Unknown app_action: ${app_action}`);
    }

    if (dry_run) {
        return `[DRY RUN] Would execute AppleScript:\n${script}`;
    }

    await runCommand(`osascript -e '${script}'`);
    return `Successfully executed: ${app_action} ${app_name}`;
}

// Action: System Info
function getSystemInfo() {
    return {
        platform: os.platform(),
        release: os.release(),
        arch: os.arch(),
        cpus: os.cpus().length,
        memory_total: (os.totalmem() / 1024 / 1024 / 1024).toFixed(2) + ' GB',
        memory_free: (os.freemem() / 1024 / 1024 / 1024).toFixed(2) + ' GB',
        uptime: (os.uptime() / 3600).toFixed(2) + ' hours'
    };
}

(async () => {
    try {
        let result;
        switch (action) {
            case 'analyze_files':
                result = await analyzeFiles();
                break;
            case 'organize_files':
                result = await organizeFiles();
                break;
            case 'control_app':
                result = await controlApp();
                break;
            case 'get_system_info':
                result = getSystemInfo();
                break;
            default:
                throw new Error(`Unknown action: ${action}`);
        }
        process.stdout.write(JSON.stringify({ output: result }));
    } catch (error) {
        process.stdout.write(JSON.stringify({ error: error.message }));
    }
})();
