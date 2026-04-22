import type { AudioParams } from "./AudioParams";

export type TimerOption = {
    label: string|null;
    duration: number;
    ringBellWhenRemaining: number|null;
}

export type ResourceMappingType = {
    resource_id: string|null;
    gain: number;
}

export type Config = {
    teamName: string|null;
    theme: {
        hue: number;
    };
    timerOptions: TimerOption[];
    audioParams: AudioParams;
    resourceMapping: {
        finalBell: ResourceMappingType;
        reminderBell: ResourceMappingType;
    }
}

export type ClockInstanceInfo = {
    id: string;
    config: Config;
    audioParams: AudioParams;
}

export function getDefaultConfig(): Config {
    return {
        teamName: "Team 1",
        theme: {
            hue: 0,
        },
        timerOptions: [
            { label: 'Example', duration: 5, ringBellWhenRemaining: 4 },
            { label: '1 Minute', duration: 60, ringBellWhenRemaining: null },
            { label: '3 Minutes', duration: 3 * 60, ringBellWhenRemaining: 30 },
            { label: '5 Minutes', duration: 5 * 60, ringBellWhenRemaining: 30 },
            { label: '8 Minutes', duration: 8 * 60, ringBellWhenRemaining: 30 },
            { label: '10 Minutes', duration: 10 * 60, ringBellWhenRemaining: 30 },
        ],
        audioParams: {
            pan: 0,
            gain: 1,
        },
        resourceMapping: {
            finalBell: { resource_id: null, gain: 1 },
            reminderBell: { resource_id: null, gain: 1 },
        }

    };
}

function validateResourceMapping(mapping: any): mapping is ResourceMappingType {
    if (typeof mapping !== 'object' || mapping === null) return false;
    if (mapping.resource_id !== null && typeof mapping.resource_id !== 'string') return false;
    if (typeof mapping.gain !== 'number') return false;
    return true;
}

export function validateConfig(config: any): config is Config {
    if(typeof config !== 'object' || config === null) return false;
    if(config.teamName !== null && typeof config.teamName !== 'string') return false;
    if(config.theme === undefined || typeof config.theme !== 'object' || config.theme === null) return false;
    if(typeof config.theme.hue !== 'number') return false;
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
    if(config.resourceMapping === undefined || typeof config.resourceMapping !== 'object' || config.resourceMapping === null) return false;
    for(const key of Object.keys(config.resourceMapping) as (keyof typeof config.resourceMapping)[]){
        const mapping = config.resourceMapping[key];
        if(!validateResourceMapping(mapping)) return false;
    }
    return true;
}
