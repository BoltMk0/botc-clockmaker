import { isTimerOption, type TimerOption } from "./timerOption";

export type ResourceMappingType = {
    resource_id: string|null;
}

function isResourceMappingType(data: any): data is ResourceMappingType{
    if(typeof data !== 'object') return false;
    if(typeof data.resource_id !== 'string' && data.resource_id !== null) return false;
    return true;
}

export type Config = {
    teamName: string|null;
    theme: {
        hue: number;
    };
    resourceMapping: {
        finalBell: ResourceMappingType;
        reminderBell: ResourceMappingType;
    }
}

export function isConfig(data: any): data is Config {
    if(typeof data !== 'object') return false;
    if(typeof data.teamName !== 'string') return false;
    if(typeof data.theme !== 'object') return false;
    if(typeof data.resourceMapping !== 'object') return false;
    if(!isResourceMappingType(data.resourceMapping.finalBell)) return false;
    if(!isResourceMappingType(data.resourceMapping.reminderBell)) return false
    return true;
}

export type ClockInstanceInfo = {
    id: string;
    config: Config;
}

export function getDefaultConfig(): Config {
    return {
        teamName: "Team 1",
        theme: {
            hue: 0,
        },
        resourceMapping: {
            finalBell: { resource_id: null },
            reminderBell: { resource_id: null },
        }
    };
}
