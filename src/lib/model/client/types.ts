/** Every phase of the day, in the order they're shown and the order they come round in. */
export const TIMES_OF_DAY = ['day', 'dusk', 'night'] as const;

export type TimeOfDay = typeof TIMES_OF_DAY[number];

export const TIME_OF_DAY_LABELS: Record<TimeOfDay, string> = { day: 'Day', dusk: 'Dusk', night: 'Night' };

export function isTimeOfDay(value: any): value is TimeOfDay {
    return TIMES_OF_DAY.includes(value);
}

/**
 * The one phase for several games each in their own phase: the earliest in the day wins, so it's day if any game is
 * in daytime, and only night once every game is. Night when there are no games.
 */
export function combineTimesOfDay(timesOfDay: Iterable<TimeOfDay>): TimeOfDay {
    let index = TIMES_OF_DAY.length - 1;
    for(const timeOfDay of timesOfDay) index = Math.min(index, TIMES_OF_DAY.indexOf(timeOfDay));
    return TIMES_OF_DAY[index];
}
