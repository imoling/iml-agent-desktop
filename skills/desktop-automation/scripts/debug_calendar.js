const { exec } = require('child_process');

function runJXA(script) {
    return new Promise((resolve, reject) => {
        const command = `osascript -l JavaScript -e '${script.replace(/'/g, "'\\''")}'`;
        exec(command, (error, stdout, stderr) => {
            if (error) reject(stderr);
            else resolve(stdout);
        });
    });
}

(async () => {
    console.log("Testing JXA Calendar Access...");
    const script = `
        var app = Application('Calendar');
        var cals = app.calendars();
        var output = [];
        for (var i=0; i<cals.length; i++) {
            var name = cals[i].name();
            output.push("Cal: " + name);
            // Try to get ONE event to verify access
            try {
                var evts = cals[i].events.whose({ startDate: { _ge: new Date() }})(); // Future events
                if (evts.length > 0) {
                    output.push("  Found " + evts.length + " future events.");
                    output.push("  First: " + evts[0].summary());
                } else {
                    output.push("  No future events found via whose.");
                }
            } catch(e) {
                output.push("  Error reading events: " + e.message);
            }
        }
        JSON.stringify(output);
    `;

    try {
        const res = await runJXA(script);
        console.log("Result:", res);
    } catch (e) {
        console.error("Error:", e);
    }
})();
