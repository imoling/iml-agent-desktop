const args = JSON.parse(process.argv[2] || '{}');
const { action, expression, base_date } = args;

function getCurrentTime() {
    const now = new Date();
    return {
        iso: now.toISOString(),
        local: now.toLocaleString(),
        weekday: now.toLocaleDateString('en-US', { weekday: 'long' }),
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        day: now.getDate()
    };
}

function resolveDate(expr, base) {
    if (!expr) throw new Error("Missing 'expression' for resolve_date");

    const now = base ? new Date(base) : new Date();
    // Reset time to 00:00:00 for date calculations to avoid timezone shifts affecting date part?
    // Actually, let's keep 'now' current time but calculations often want "the date".
    // Let's operate at 12:00 PM to avoid DST overlaps for simple day adds.
    const ref = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);

    let target = new Date(ref);
    const lowerExpr = expr.toLowerCase().trim();

    if (lowerExpr === 'today') {
        // no change
    } else if (lowerExpr === 'tomorrow') {
        target.setDate(ref.getDate() + 1);
    } else if (lowerExpr === 'yesterday') {
        target.setDate(ref.getDate() - 1);
    } else if (lowerExpr === 'day after tomorrow') {
        target.setDate(ref.getDate() + 2);
    } else if (lowerExpr.match(/next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/)) {
        // "next friday"
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayName = lowerExpr.replace('next', '').trim();
        const dayIndex = days.indexOf(dayName);
        if (dayIndex === -1) throw new Error("Invalid weekday");

        const currentParamsDay = ref.getDay();
        // Next X:
        // if today is Monday (1), next Monday is +7.
        // if today is Sunday (0), next Monday is +1.
        // Usually "next friday" means the one in the next week? Or just the upcoming one?
        // Colloquially:
        // "This Friday" = upcoming friday (or today).
        // "Next Friday" = Friday of next week.
        // Let's implement: "Next X" = date of X in the *following* week (7+ days away) OR simply upcoming?
        // Strictly: "Next Friday" often means the Friday of the *next* week. "This Friday" is the upcoming one.
        // But LLM might just say "next friday" for "the coming friday".
        // Let's stick to: Upcoming X. If today is X, then X+7.

        let dist = (dayIndex + 7 - currentParamsDay) % 7;
        if (dist === 0) dist = 7; // Next occurrence
        target.setDate(ref.getDate() + dist);
    } else if (lowerExpr.match(/this\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/)) {
        // "this friday" -> upcoming (dist 0-6)
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayName = lowerExpr.replace('this', '').trim();
        const dayIndex = days.indexOf(dayName);

        let dist = (dayIndex + 7 - ref.getDay()) % 7;
        // If today is Friday, "this Friday" is today.
        target.setDate(ref.getDate() + dist);
    } else if (lowerExpr.match(/(\d+)\s+days?\s+later/)) {
        const n = parseInt(lowerExpr.match(/(\d+)/)[1]);
        target.setDate(ref.getDate() + n);
    } else if (lowerExpr.match(/in\s+(\d+)\s+days?/)) {
        const n = parseInt(lowerExpr.match(/(\d+)/)[1]);
        target.setDate(ref.getDate() + n);
    } else if (lowerExpr.match(/(\d+)\s+weeks?\s+later/)) {
        const n = parseInt(lowerExpr.match(/(\d+)/)[1]);
        target.setDate(ref.getDate() + n * 7);
    } else {
        // Fallback: try parsing as relative date?
        // Or assume it's just unknown.
        // Return original or error.
        // Let's try flexible parse
        const tryDate = new Date(expr);
        if (!isNaN(tryDate.getTime())) {
            target = tryDate;
        } else {
            throw new Error(`Cannot parse relative date: ${expr}`);
        }
    }

    return {
        expression: expr,
        date: target.toISOString().split('T')[0], // YYYY-MM-DD
        iso: target.toISOString(),
        weekday: target.toLocaleDateString('en-US', { weekday: 'long' })
    };
}

// Main execution
try {
    let result;
    switch (action) {
        case 'get_current_time':
            result = getCurrentTime();
            break;
        case 'resolve_date':
            result = resolveDate(expression, base_date);
            break;
        default:
            throw new Error(`Unknown action: ${action}`);
    }
    process.stdout.write(JSON.stringify(result));
} catch (error) {
    process.stdout.write(JSON.stringify({ error: error.message }));
}
