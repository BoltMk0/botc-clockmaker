import type { AudioParams } from "./AudioParams";

export type TimerOption = {
    label: string|null;
    duration: number;
    ringBellWhenRemaining: number|null;
}

export type Config = {
    teamName: string|null;
    theme: {
        rimColor: string;
        tickColor: string;
    };
    timerOptions: TimerOption[];
    audioParams: AudioParams;
}

export function getDefaultConfig(): Config {
    return {
        teamName: null,
        theme: {
            rimColor: "#223",
            tickColor: "#000"
        },
        timerOptions: [
            { label: '5 Seconds', duration: 5, ringBellWhenRemaining: null },
            { label: '15 Seconds', duration: 15, ringBellWhenRemaining: 5 },
            { label: '1 Minute', duration: 60, ringBellWhenRemaining: null },
            { label: '3 Minutes', duration: 3 * 60, ringBellWhenRemaining: 30 },
            { label: '5 Minutes', duration: 5 * 60, ringBellWhenRemaining: 30 },
            { label: '8 Minutes', duration: 8 * 60, ringBellWhenRemaining: 30 },
        ],
        audioParams: {
            pan: 0,
            gain: 1,
        }
    };
}

export function validateConfig(config: any): config is Config {
    if(typeof config !== 'object' || config === null) return false;
    if(config.teamName !== null && typeof config.teamName !== 'string') return false;
    if(config.theme === undefined || typeof config.theme !== 'object' || config.theme === null) return false;
    if(typeof config.theme.rimColor !== 'string') return false;
    if(typeof config.theme.tickColor !== 'string') return false;
    if(!Array.isArray(config.timerOptions)) return false;
    for(const option of config.timerOptions){
        if(typeof option !== 'object' || option === null) return false;
        if(typeof option.duration !== 'number' || option.duration <= 0) return false;
        if(option.label !== null && typeof option.label !== 'string') return false;
        if(option.ringBellWhenRemaining !== null && (typeof option.ringBellWhenRemaining !== 'number' || option.ringBellWhenRemaining < 0)) return false;
    }
    if(config.audioParams === undefined || typeof config.audioParams !== 'object' || config.audioParams === null) return false;
    if(typeof config.audioParams.pan !== 'number') return false;
    if(typeof config.audioParams.gain !== 'number') return false;
    return true;
}
