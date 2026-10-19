import type { TimeOfDay } from "$lib/model/client/types";
import { isAudioResourceTrackModel, type AudioResourceTrackModel } from "./audioResourceTrackModel";

export interface AmbienceTrackModel extends AudioResourceTrackModel{
    activeInMorning: boolean;
    activeInDay: boolean;
    activeAtDusk: boolean;
    activeAtNight: boolean;
    /**
     * Which speakers it plays from on a device set to 4.0: the front pair, the rear pair, or both - the rear then playing
     * the same loop half its length apart, so the two don't sound alike. Never both false. A stereo device plays it once
     * at the front if either is set.
     */
    outputFront: boolean;
    outputRear: boolean;
}

/** The track's flag for whether it plays in each phase. */
export const AMBIENCE_ACTIVE_KEYS = {
    morning: 'activeInMorning',
    day: 'activeInDay',
    dusk: 'activeAtDusk',
    night: 'activeAtNight'
} as const satisfies Record<TimeOfDay, keyof AmbienceTrackModel>;

/**
 * Upgrades, in place, a saved track from before the dusk phase (it plays at dusk if it played at night), the morning
 * phase (it plays in the morning if it played in the day) or 4.0 output (it plays from the front and the rear).
 */
export function migrateLegacyAmbienceTrack(data: any) {
    if(typeof data !== 'object' || data === null) return;
    if(data.activeAtDusk === undefined && typeof data.activeAtNight === 'boolean') data.activeAtDusk = data.activeAtNight;
    if(data.activeInMorning === undefined && typeof data.activeInDay === 'boolean') data.activeInMorning = data.activeInDay;
    if(data.outputFront === undefined) data.outputFront = true;
    if(data.outputRear === undefined) data.outputRear = true;
}

export function isAmbienceTrackModel(data: any): data is AmbienceTrackModel {
    if(typeof data !== 'object') return false;
    if(typeof data.activeInMorning !== 'boolean') return false;
    if(typeof data.activeInDay !== 'boolean') return false;
    if(typeof data.activeAtDusk !== 'boolean') return false;
    if(typeof data.activeAtNight !== 'boolean') return false;
    if(typeof data.outputFront !== 'boolean') return false;
    if(typeof data.outputRear !== 'boolean') return false;
    if(!isAudioResourceTrackModel(data)) return false;
    return true;
}
