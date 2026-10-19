import { isAmbienceTrackModel, migrateLegacyAmbienceTrack, type AmbienceTrackModel } from "./ambienceTrackModel";
import { isAudioTrackGroupModel, type AudioTrackGroupModel } from "./audioTrackGroupModel.svelte";

/**
 * Shared (server-persisted) state of the ambience engine. Time of day is deliberately not part of this:
 * each client derives it from the live state of the clocks.
 */
export interface AmbienceEngineModel extends AudioTrackGroupModel<AmbienceTrackModel>{
    playing: boolean;
    /**
     * Balance between the front and rear speakers on a device set to 4.0, from -1 (front only) to 1 (rear only): at 0
     * both are at full level, and moving it one way turns the other pair down. A stereo device ignores it.
     */
    frontRear: number;
}

/** Partial update of the engine-level fields, as sent to / broadcast by the server. */
export type AmbienceEnginePatch = Partial<Pick<AmbienceEngineModel, 'playing'|'gain'|'pan'|'frontRear'>>;
/** Partial update of one ambience track, as sent to / broadcast by the server. */
export type AmbienceTrackPatch = Partial<Pick<AmbienceTrackModel, 'gain'|'pan'|'activeInMorning'|'activeInDay'|'activeAtDusk'|'activeAtNight'|'outputFront'|'outputRear'|'loadedResourceId'>>;

export function isAmbienceEngineModel(data: any): data is AmbienceEngineModel {
    if(typeof data !== 'object' || data === null) return false;
    if(typeof data.playing !== 'boolean') return false;
    if(typeof data.frontRear !== 'number') return false;
    if(!isAudioTrackGroupModel(data, isAmbienceTrackModel)) return false;
    return true;
}

/** Upper limit on the number of ambience tracks, so a stray click-fest can't spawn an unbounded number of them. */
export const MAX_AMBIENCE_TRACKS = 16;

export function newAmbienceTrackModel(): AmbienceTrackModel {
    return {
        gain: 1,
        pan: 0,
        loadedResourceId: null,
        activeAtNight: true,
        activeAtDusk: true,
        activeInDay: true,
        activeInMorning: true,
        outputFront: true,
        outputRear: true
    };
}

export function newAmbienceEngineModel(nTracks: number = 4): AmbienceEngineModel {
    return {
        playing: false,
        tracks: Array.from({length: nTracks}, newAmbienceTrackModel),
        gain: 1,
        pan: 0,
        frontRear: 0
    }
}

/** Upgrades, in place, a saved engine (and its tracks) from before any change to their fields, so it validates. */
export function migrateLegacyAmbienceEngine(data: any) {
    if(typeof data !== 'object' || data === null) return;
    if(data.frontRear === undefined) data.frontRear = 0;
    if(Array.isArray(data.tracks)) data.tracks.forEach(migrateLegacyAmbienceTrack);
}
