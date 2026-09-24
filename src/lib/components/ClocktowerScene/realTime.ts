// Maps the real-world (local) time of day onto the clocktower scene, for
// decorative views that show "now" rather than a game's countdown.

// A fixed daylight window, in local hours: the scene's day (progress 0 -> 1)
// runs from DAY_START_HOUR to DAY_END_HOUR, and it's night outside it.
export const DAY_START_HOUR = 8;
export const DAY_END_HOUR = 18;

function hoursSinceMidnight(now: Date): number {
    return now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600 + now.getMilliseconds() / 3_600_000;
}

// The scene's 0-1 day progress for the given time: 0 at sunrise, 1 at sunset,
// and held at 1 (night) until the next sunrise.
export function realTimeDayProgress(now: Date): number {
    const hours = hoursSinceMidnight(now);
    if (hours < DAY_START_HOUR || hours >= DAY_END_HOUR) return 1;
    return (hours - DAY_START_HOUR) / (DAY_END_HOUR - DAY_START_HOUR);
}

// Where a real clock's hands point for the given time, in turns clockwise from 12 o'clock.
export function realTimeHandProgress(now: Date): { minute: number; hour: number } {
    const hours = hoursSinceMidnight(now);
    return { minute: hours % 1, hour: (hours % 12) / 12 };
}
