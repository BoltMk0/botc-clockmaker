import type { ClockInstanceInfo } from "$lib/common/config";
import { isAudioTrackModel, type AudioTrackModel } from "./audioTrackModel.svelte";


export interface ClocktowerAudioTrackModel extends AudioTrackModel {
    balance: number;
    resources: {
        finalBell: string|null;
        reminderBell: string|null;
    }
}

export function isClocktowerAudioTrackModel(data: any): data is ClocktowerAudioTrackModel {
    if(typeof data !== 'object') return false;
    if(typeof data.balance !== 'number') return false;
    if(typeof data.resources !== 'object') return false;
    if(typeof data.resources.finalBell !== 'string' && data.resources.finalBell !== null) return false;
    if(typeof data.resources.reminderBell !== 'string' && data.resources.reminderBell !== null) return false;
    if(!isAudioTrackModel(data)) return false;
    return true;
}

export function newClocktowerAudioTrackModel(clockInstanceInfo: ClockInstanceInfo): ClocktowerAudioTrackModel{
    return {
        gain: 1,
        pan: 0,
        balance: 0,
        resources: {
            finalBell: clockInstanceInfo.config.resourceMapping.finalBell.resource_id,
            reminderBell: clockInstanceInfo.config.resourceMapping.reminderBell.resource_id
        }
    };
}
