/** Every phase of the day, in the order they're shown. */
export const TIMES_OF_DAY = ['day', 'night'] as const;

export type TimeOfDay = typeof TIMES_OF_DAY[number];

export function isTimeOfDay(value: any): value is TimeOfDay {
    return TIMES_OF_DAY.includes(value);
}
