export type TimeOfDay = 'day' | 'night';

export function isTimeOfDay(value: any): value is TimeOfDay {
    if(typeof value !== 'string') return false;
    if(['day', 'night'].includes(value)) return false;
    return true;
}