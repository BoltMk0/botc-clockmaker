export type TimerOption = {
    label: string|null;
    duration: number;
    ringBellWhenRemaining: number|null;
}

export function getDefaultTimerOptions(): TimerOption[] {
    return  [
        { label: 'Example', duration: 5, ringBellWhenRemaining: 4 },
        { label: '1 Minute', duration: 60, ringBellWhenRemaining: null },
        { label: '3 Minutes', duration: 3 * 60, ringBellWhenRemaining: 30 },
        { label: '5 Minutes', duration: 5 * 60, ringBellWhenRemaining: 30 },
        { label: '8 Minutes', duration: 8 * 60, ringBellWhenRemaining: 30 },
        { label: '10 Minutes', duration: 10 * 60, ringBellWhenRemaining: 30 },
    ]
}

export function isTimerOption(data: any): data is TimerOption {
    if(typeof data !== 'object') return false;
    if(typeof data.label !== 'string') return false;
    if(typeof data.duration !== 'number') return false;
    if(data.ringBellWhenRemaining !== null && typeof data.ringBellWhenRemaining !== 'number') return false;
    return true;
}
