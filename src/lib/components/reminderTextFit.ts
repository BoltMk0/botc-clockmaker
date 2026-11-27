// Fits a reminder token's text to the token: the font size is a fraction of the token's size, chosen from the
// text alone, so one fit serves every size a token is drawn at.

export const REMINDER_FONT_FAMILY = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif";
export const REMINDER_LINE_HEIGHT = 1.1;

/** The widest a line may be, as a fraction of the token's size: a little past its edges. */
const MAX_WIDTH = 1.2;
/** The tallest the text block may be, as a fraction of the token's size. */
const MAX_HEIGHT = 0.45;
/** Short text stops growing here, so "DEAD" isn't shouted. */
const MAX_FONT = 0.2;

let ctx: CanvasRenderingContext2D | null | undefined;
const widthCache = new Map<string, number>();

/** A line's width in ems, uppercased as the token shows it. */
function emWidth(line: string, measure = true): number {
    const text = line.toUpperCase();
    if (!measure) return text.length * 0.68;
    const cached = widthCache.get(text);
    if (cached !== undefined) return cached;
    if (ctx === undefined) {
        ctx = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
        if (ctx) ctx.font = `100px ${REMINDER_FONT_FAMILY}`;
    }
    // Without a canvas (server rendering), estimate from an average capital's width.
    const width = ctx ? ctx.measureText(text).width / 100 : text.length * 0.68;
    if (ctx) widthCache.set(text, width);
    return width;
}

function fontFor(lines: string[], measure = true): number {
    const widest = Math.max(...lines.map(l => emWidth(l, measure)), 0.01);
    return Math.min(MAX_FONT, MAX_WIDTH / widest, MAX_HEIGHT / (lines.length * REMINDER_LINE_HEIGHT));
}

/** Splits a line at the space that leaves its two halves most even, or null if it has no space. */
function splitEvenly(line: string): [string, string] | null {
    let best: [string, string] | null = null;
    let bestWidth = Infinity;
    for (let i = line.indexOf(' '); i !== -1; i = line.indexOf(' ', i + 1)) {
        const parts: [string, string] = [line.slice(0, i).trim(), line.slice(i + 1).trim()];
        if (!parts[0] || !parts[1]) continue;
        const width = Math.max(emWidth(parts[0]), emWidth(parts[1]));
        if (width < bestWidth) { bestWidth = width; best = parts; }
    }
    return best;
}

/**
 * The lines to show and their font size as a fraction of the token's size. The text's own line breaks are kept;
 * a wide line is broken further at a space whenever that lets the text be drawn larger.
 * Unmeasured, it estimates from the letter count and keeps the text's own lines: what the server renders, and so
 * what the first render in the browser must match.
 */
export function fitReminderText(text: string, measure = true): { lines: string[]; font: number } {
    let lines = text.split('\n').map(l => l.trim());
    let font = fontFor(lines, measure);
    if (!measure) return { lines, font };
    for (;;) {
        const widestIndex = lines.reduce((w, l, i) => emWidth(l) > emWidth(lines[w]) ? i : w, 0);
        const split = splitEvenly(lines[widestIndex]);
        if (!split) break;
        const candidate = [...lines.slice(0, widestIndex), ...split, ...lines.slice(widestIndex + 1)];
        const candidateFont = fontFor(candidate);
        if (candidateFont <= font) break;
        lines = candidate;
        font = candidateFont;
    }
    return { lines, font };
}
