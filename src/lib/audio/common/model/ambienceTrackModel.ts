import type { TimeOfDay } from "$lib/model/client/types";
import { isAudioResourceTrackModel, type AudioResourceTrackModel } from "./audioResourceTrackModel";

export interface AmbienceTrackModel extends AudioResourceTrackModel{
    activeInMorning: boolean;
    activeInDay: boolean;
    activeAtDusk: boolean;
    activeAtNight: boolean;
}

/** The track's flag for whether it plays in each phase. */
export const AMBIENCE_ACTIVE_KEYS = {
    morning: 'activeInMorning',
    day: 'activeInDay',
    dusk: 'activeAtDusk',
    night: 'activeAtNight'
} as const satisfies Record<TimeOfDay, keyof AmbienceTrackModel>;

/**
 * Upgrades, in place, a saved track from before the dusk phase (it plays at dusk if it played at night) or the morning
 * phase (it plays in the morning if it played in the day).
 */
export function migrateLegacyAmbienceTrack(data: any) {
    if(typeof data !== 'object' || data === null) return;
    if(data.activeAtDusk === undefined && typeof data.activeAtNight === 'boolean') data.activeAtDusk = data.activeAtNight;
    if(data.activeInMorning === undefined && typeof data.activeInDay === 'boolean') data.activeInMorning = data.activeInDay;
}

export function isAmbienceTrackModel(data: any): data is AmbienceTrackModel {
    if(typeof data !== 'object') return false;
    if(typeof data.activeInMorning !== 'boolean') return false;
    if(typeof data.activeInDay !== 'boolean') return false;
    if(typeof data.activeAtDusk !== 'boolean') return false;
    if(typeof data.activeAtNight !== 'boolean') return false;
    if(!isAudioResourceTrackModel(data)) return false;
    return true;
}
