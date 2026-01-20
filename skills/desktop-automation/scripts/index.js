const { exec } = require('child_process');

// Parse Arguments
const args = JSON.parse(process.argv[2] || '{}');
const {
    action,
    // Calendar
    title, start_time, end_time, notes,
    // Email
    to_email, subject, body, attachment_path,
    count, // For reading
    // Message
    app_target, contact_name, message_content
} = args;

function runOsascript(script, lang = 'AppleScript') {
    return new Promise((resolve, reject) => {
        const langFlag = lang === 'JavaScript' ? '-l JavaScript' : '';
        const command = `osascript ${langFlag} -e '${script.replace(/'/g, "'\\''")}'`;
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(stderr || error.message);
            } else {
                resolve(stdout.trim());
            }
        });
    });
}

// Escape for AppleScript string
function esc(str) {
    if (!str) return '';
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

// JXA Helper: Escape for JS string
function escJS(str) {
    if (!str) return '';
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

async function addCalendarEvent() {
    if (!title || !start_time || !end_time) throw new Error("Missing title, start_time, or end_time");

    // JXA Implementation for robust date parsing. Adds to default calendar (Home or First).
    const script = `
        var app = Application('Calendar');
        var calendar = app.calendars.byName('Home');
        try { if (!calendar.exists()) calendar = app.calendars[0]; } catch(e) { calendar = app.calendars[0]; }
        
        var startDate = new Date("${start_time}");
        var endDate = new Date("${end_time}");
        
        if (isNaN(startDate.getTime())) throw new Error("Invalid start time format");
        
        var event = app.Event({
            summary: "${escJS(title)}",
            startDate: startDate,
            endDate: endDate,
            description: "${escJS(notes || '')}"
        });
        
        calendar.events.push(event);
        "Success: Created event '" + event.summary() + "' in " + calendar.name();
    `;

    return await runOsascript(script, 'JavaScript');
}

async function listCalendarEvents() {
    // Default to today if not specified
    const start = start_time || new Date().toISOString();
    const end = end_time || new Date(Date.now() + 86400000).toISOString();

    // Use AppleScript instead of JXA because JXA date filtering is broken ("Illegal comparison")
    const script = `
        set startDate to (current date)
        -- Reset to provided start/end
        -- AppleScript date parsing is locale dependent, so we build it manually from ISO components is safer, 
        -- OR we pass components. But parsing "2026-01-18T..." in AS is hard.
        -- Simpler: Use JXA to set the date, then standard AppleScript for logic? No, mixed mode is complex.
        -- Safe bet: Use shell to date command to format for AppleScript? 
        -- Or just assume ISO works? No.
        
        -- Let's construct date from JS and pass as string compatible with current locale? Risky.
        -- Best way: "date '...'" in AppleScript often fails.
        -- Let's use JXA to iterate "manually" without 'whose'? 
        -- If JXA 'whose' fails, manual iteration in JXA is fine for limited range.
        -- Wait, 'whose' failed. Manual iteration:
    `;

    // Re-attempting JXA with MANUAL iteration (no 'whose')
    // This is slower but works.
    const jxaManualScript = `
        var app = Application('Calendar');
        var calendars = app.calendars();
        var start = new Date("${start}");
        var end = new Date("${end}");
        var output = [];
        
        function safeDate(d) {
            try { return d.toISOString(); } catch(e) { return null; }
        }

        for (var i = 0; i < calendars.length; i++) {
            var cal = calendars[i];
            // Get ALL events? No, that's potentially thousands.
            // Some calendars support range retrieval? No.
            // Optimization: Many users don't have that many events.
            // But if they do, this hangs.
            
            // Try AppleScript wrapper for just this part?
            // "events of calendar X where start date > Y"
        }
    `;

    // Robust AppleScript Solution:
    // We pass the date components to ensure safety.
    const sDate = new Date(start);
    const eDate = new Date(end);

    // Construct AppleScript date string: "date \"General format\"" is risky.
    // Use: set d to current date, set year of d to ..., set month of d to ...
    const setDateAS = (d, varName) => `
        set ${varName} to current date
        set year of ${varName} to ${d.getFullYear()}
        set month of ${varName} to ${d.getMonth() + 1}
        set day of ${varName} to ${d.getDate()}
        set hours of ${varName} to ${d.getHours()}
        set minutes of ${varName} to ${d.getMinutes()}
        set seconds of ${varName} to ${d.getSeconds()}
    `;

    const asScript = `
        ${setDateAS(sDate, 'startDate')}
        ${setDateAS(eDate, 'endDate')}
        
        set output to ""
        tell application "Calendar"
            repeat with c in calendars
                set cName to name of c
                -- Filter events
                set myEvents to (every event of c where start date ≥ startDate and start date ≤ endDate)
                repeat with e in myEvents
                    set t to summary of e
                    try
                        set d to description of e
                    on error
                        set d to ""
                    end try
                    set s to start date of e
                    set f to end date of e
                    
                    -- manual JSON construction (basic)
                    set output to output & "{\\"calendar\\":\\"" & cName & "\\", \\"title\\": \\"" & t & "\\", \\"start\\": \\"" & (s as string) & "\\", \\"end\\": \\"" & (f as string) & "\\", \\"notes\\": \\"" & d & "\\"},"
                end repeat
            end repeat
        end tell
        if length of output > 0 then
            set output to text 1 thru -2 of output -- remove last comma
        end if
        return "[" & output & "]"
    `;

    // Run as AppleScript
    // Note: 'notes' might contain quotes, dealing with escaping in manual JSON is painful.
    // JXA Manual Loop is safer for JSON, despite speed.
    // Let's TRY JXA MANUAL LOOP but restrict to "today" if possible?
    // User asked "today".
    // I will try JXA Manual Loop. Indexing events by date isn't possible directly.

    // BACK TO APPLESCRIPT with JXA wrap?
    // Let's use standard AppleScript and use a helper to sanitized strings.
    // Or... use JXA but iterate checking date in JS.
    // "events()" returns a proxy array. Accessing "events().length" is fast?
    // Accessing "events()[i].startDate()" is slow if 1000 events.

    // BUT: "events whose { startDate >= ... }" failed.
    // Did I use the right syntax?
    // "startDate: { _ge: ... }" is correct.
    // Error: "Illegal comparison". Maybe one event has "missing value" for start date?
    // Or maybe "smart attributes".

    // FINAL DECISION: AppleScript with `where start date > ...` is the only robust way.
    // I will handle JSON escaping simply by removing quotes/newlines for now to ensure validity.

    const safeAS = `
        ${setDateAS(sDate, 'startDate')}
        ${setDateAS(eDate, 'endDate')}
        
        set jsonList to {}
        
        tell application "Calendar"
            set allCalendars to calendars
            repeat with myCal in allCalendars
                set calName to name of myCal
                set matchingEvents to (every event of myCal where start date ≥ startDate and start date ≤ endDate)
                
                repeat with myEvent in matchingEvents
                    set evtTitle to summary of myEvent
                    set evtStart to (start date of myEvent) as string
                    set evtEnd to (end date of myEvent) as string
                    try
                        set evtNotes to description of myEvent
                        if evtNotes is missing value then set evtNotes to ""
                    on error
                        set evtNotes to ""
                    end try
                    
                    -- Simple JSON object
                    set end of jsonList to {calendar:calName, title:evtTitle, start:evtStart, end:evtEnd, notes:evtNotes}
                end repeat
            end repeat
        end tell
        
        return jsonList
    `;

    // AppleScript can return a List of Records, which `osascript -l JavaScript` can receive?
    // No, running AS returns string usually.
    // Use `osascript` (AppleScript) -> returns comma separated values?
    // Actually, asking AppleScript to return a List of Records gives `{{calendar:"...", ...}, ...}` which is not JSON.

    // COMBINED STRATEGY:
    // Run AppleScript to get the IDs (uid) of matching events.
    // Then use JXA to fetch those IDs (fast) and jsonify.

    const hybridScript = `
        ${setDateAS(sDate, 'startDate')}
        ${setDateAS(eDate, 'endDate')}
        
        set uidList to {}
        tell application "Calendar"
            repeat with c in calendars
                set uids to uid of (every event of c where start date ≥ startDate and start date ≤ endDate)
                set uidList to uidList & uids
            end repeat
        end tell
        
        -- Join with pipe
        set tid to AppleScript's text item delimiters
        set AppleScript's text item delimiters to "|"
        set res to uidList as text
        set AppleScript's text item delimiters to tid
        return res
    `;

    const uidsPipe = await runOsascript(hybridScript, 'AppleScript');
    if (!uidsPipe) return [];

    // Now JXA to fetch details by specific ID (or simply iterate and find? No, ID search in JXA?)
    // JXA: `calendar.events.byId(uid)` works.
    // But we need to find which calendar?
    // `app.calendars().events.byId()`? No.

    // Accessing by UID across all calendars is tricky.

    // OK, let's go back to JXA Manual Filter. 
    // Is it really that slow to check dates of X events?
    // For "Today", we can probably just fetch all and filter in memory?
    // Let's try the JXA `.events()` which returns ALL events.
    // If user has 5000 events...

    // Okay, AppleScript return JSON string manually is the most robust way.
    // I will write a simple JSON string builder in AppleScript.

    const asJsonScript = `
        ${setDateAS(sDate, 'ASStart')}
        ${setDateAS(eDate, 'ASEnd')}
        
        -- String escaping helper
        on cleanStr(s)
            if s is missing value then return ""
            set str to s as string
            set str to replaceText(str, "\\\\", "\\\\\\\\") -- escape backslash
            set str to replaceText(str, "\\"", "\\\\\\\"") -- escape quotes
            set str to replaceText(str, "\\n", " ") -- remove newlines
            return str
        end cleanStr
        
        on replaceText(theString, find, replace)
             set saveTID to AppleScript's text item delimiters
             set AppleScript's text item delimiters to find
             set theList to text items of theString
             set AppleScript's text item delimiters to replace
             set theString to theList as string
             set AppleScript's text item delimiters to saveTID
             return theString
        end replaceText
        
        set jsonOutput to "["
        
        tell application "Calendar"
            repeat with c in calendars
                set cName to name of c
                set evts to (every event of c where start date ≥ ASStart and start date ≤ ASEnd)
                repeat with e in evts
                   set t to my cleanStr(summary of e)
                   set s to (start date of e) as string
                   set f to (end date of e) as string
                   try
                      set n to my cleanStr(description of e)
                   on error
                      set n to ""
                   end try
                   
                   set jsonOutput to jsonOutput & "{\\"calendar\\":\\"" & cName & "\\", \\"title\\":\\"" & t & "\\", \\"start\\":\\"" & s & "\\", \\"end\\":\\"" & f & "\\", \\"notes\\":\\"" & n & "\\"},"
                end repeat
            end repeat
        end tell
        
        if length of jsonOutput > 1 then
           set jsonOutput to text 1 thru -2 of jsonOutput
        end if
        set jsonOutput to jsonOutput & "]"
        return jsonOutput
    `;

    return await runOsascript(asJsonScript, 'AppleScript');
}

async function sendEmail() {
    if (!to_email || !subject || !body) throw new Error("Missing email fields");
    let attachScript = '';
    if (attachment_path) {
        attachScript = `make new attachment with properties {file name:POSIX file "${esc(attachment_path)}"} at after the last paragraph`;
    }
    const script = `
      tell application "Mail"
          set newMessage to make new outgoing message with properties {subject:"${esc(subject)}", content:"${esc(body)}", visible:true}
          tell newMessage
              make new to recipient at end of to recipients with properties {address:"${esc(to_email)}"}
              ${attachScript}
          end tell
          send newMessage
      end tell
    `;
    return await runOsascript(script, 'AppleScript');
}

async function readEmails() {
    const limit = count || 5;

    const jxaScript = `
        var app = Application('Mail');
        var inbox = app.inbox();
        var messages = inbox.messages.whose({readStatus: false})();
        
        // Slice
        var limit = ${limit};
        if (messages.length > limit) messages = messages.slice(0, limit);
        
        var output = [];
        for (var i = 0; i < messages.length; i++) {
             // Basic content
             output.push({
                 subject: messages[i].subject(),
                 sender: messages[i].sender(),
                 content: messages[i].content().substring(0, 200) + "..." // Truncate
             });
        }
        JSON.stringify(output);
    `;
    return await runOsascript(jxaScript, 'JavaScript');
}

async function sendMessage() {
    if (!contact_name || !message_content) throw new Error("Missing contact or message");
    const target = (app_target || 'WeChat').toLowerCase();

    if (target.includes('message') || target.includes('短信')) {
        const script = `
          tell application "Messages"
              set targetService to 1st service whose service type = iMessage
              set targetBuddy to buddy "${esc(contact_name)}" of targetService
              send "${esc(message_content)}" to targetBuddy
          end tell
        `;
        return await runOsascript(script, 'AppleScript');
    } else {
        // WeChat (JXA UI Scripting + Clipboard)
        const script = `
           var app = Application('WeChat');
           var ca = Application.currentApplication();
           ca.includeStandardAdditions = true;

           // Robust activation via Shell (mimics clicking Dock icon)
           ca.doShellScript("open -a WeChat");
           delay(1.5);
           app.activate();
           delay(0.5);

           var sys = Application('System Events');
           
           sys.keystroke('f', { using: 'command down' });
           delay(1); 
           ca.setTheClipboardTo("${escJS(contact_name)}");
           delay(0.3);
           sys.keystroke('v', { using: 'command down' });
           delay(2.5); // Initial wait for search

           sys.keyCode(36); // Enter to open chat
           delay(2.0); // Wait for chat to load (Increased for stability)
           
           // Prepare Clipboard Content
           ca.setTheClipboardTo("${escJS(message_content)}");
           delay(0.8); // Ensure clipboard is synced

           // Activate window right before pasting
           app.activate();
           delay(0.5);

           sys.keystroke('v', { using: 'command down' }); // Paste
           delay(1.0); // Wait for large text paste
           
           sys.keyCode(36); // Enter to send
           "Sent to ${escJS(contact_name)}";
        `;
        return await runOsascript(script, 'JavaScript');
    }
}

async function readRecentMessages() {
    const target = (app_target || 'WeChat').toLowerCase();
    const limit = count || 5;

    if (target.includes('message') || target.includes('短信')) {
        // iMessage Reading
        const script = `
            var app = Application('Messages');
            var chats = app.chats();
            
            var targetChat = null;
            if ("${escJS(contact_name)}") {
                for (var i=0; i<chats.length; i++) {
                    if (chats[i].name().includes("${escJS(contact_name)}")) {
                        targetChat = chats[i];
                        break;
                    }
                }
            } else {
                targetChat = chats[0];
            }
            
            if (!targetChat) return "No chat found";
            
            var msgs = targetChat.messages();
            var len = msgs.length;
            var start = Math.max(0, len - ${limit});
            var recent = msgs.slice(start, len);
            
            var output = [];
            for (var i=0; i<recent.length; i++) {
                output.push({
                    sender: recent[i].sender(), 
                    content: recent[i].content() 
                });
            }
             JSON.stringify(output);
        `;
        return await runOsascript(script, 'JavaScript');
    } else {
        // WeChat Read (Experimental)
        if (!contact_name) throw new Error("Contact name required for WeChat reading (to select chat)");
        const script = `
           var app = Application('WeChat');
           app.activate();
           delay(1);
           var sys = Application('System Events');
           var ca = Application.currentApplication();
           ca.includeStandardAdditions = true;

           // Search & Enter Chat
           sys.keystroke('f', { using: 'command down' });
           delay(1);
           ca.setTheClipboardTo("${escJS(contact_name)}");
           delay(0.3);
           sys.keystroke('v', { using: 'command down' });
           delay(2.0);
           sys.keyCode(36);
           delay(1.5);
           
           "Chat opened: " + "${escJS(contact_name)}";
        `;
        return await runOsascript(script, 'JavaScript');
    }
}

(async () => {
    try {
        let result;
        switch (action) {
            case 'add_calendar_event': result = await addCalendarEvent(); break;
            case 'list_calendar_events': result = await listCalendarEvents(); break;
            case 'send_email': result = await sendEmail(); break;
            case 'read_emails': result = await readEmails(); break;
            case 'send_message': result = await sendMessage(); break;
            case 'read_recent_messages': result = await readRecentMessages(); break;
            default: throw new Error(`Unknown action: ${action}`);
        }

        if (typeof result !== 'string') result = JSON.stringify(result);

        try {
            const parsed = JSON.parse(result);
            process.stdout.write(JSON.stringify({ output: parsed }));
        } catch (e) {
            process.stdout.write(JSON.stringify({ output: result }));
        }
    } catch (error) {
        process.stdout.write(JSON.stringify({ error: error.message }));
    }
})();
