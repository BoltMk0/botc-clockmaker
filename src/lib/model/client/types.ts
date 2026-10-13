/** Every phase of the day, in the order they're shown and the order they come round in. */
export const TIMES_OF_DAY = ['morning', 'day', 'dusk', 'night'] as const;

/**
 * The game's phase: morning is daytime with no countdown running (set up, or paused), day while the countdown runs,
 * dusk once it's run out (or the day was ended), and night.
 */
export type TimeOfDay = typeof TIMES_OF_DAY[number];

export const TIME_OF_DAY_LABELS: Record<TimeOfDay, string> = { morning: 'Morning', day: 'Day', dusk: 'Dusk', night: 'Night' };

export function isTimeOfDay(value: any): value is TimeOfDay {
    return TIMES_OF_DAY.includes(value);
}

/** Whether it's still daytime: before the countdown's run out or the day's been ended. */
export function isDaytime(timeOfDay: TimeOfDay): boolean {
    return timeOfDay === 'morning' || timeOfDay === 'day';
}

/** Which phase wins when combining several games' phases, first to last. */
const COMBINE_PRECEDENCE: readonly TimeOfDay[] = ['day', 'morning', 'dusk', 'night'];

/**
 * The one phase for several games each in their own phase: the earliest in the day wins, so it's daytime if any game
 * is, and only night once every game is - except that any game's countdown running makes it day rather than morning.
 * Night when there are no games.
 */
export function combineTimesOfDay(timesOfDay: Iterable<TimeOfDay>): TimeOfDay {
    let index = COMBINE_PRECEDENCE.length - 1;
    for(const timeOfDay of timesOfDay) index = Math.min(index, COMBINE_PRECEDENCE.indexOf(timeOfDay));
    return COMBINE_PRECEDENCE[index];
}
