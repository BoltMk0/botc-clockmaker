import { isAmbienceTrackModel, type AmbienceTrackModel } from "./ambienceTrackModel";
import { isAudioTrackGroupModel, type AudioTrackGroupModel } from "./audioTrackGroupModel.svelte";

/**
 * Shared (server-persisted) state of the ambience engine. Time of day is deliberately not part of this:
 * each client derives it from the live state of the clocks.
 */
export interface AmbienceEngineModel extends AudioTrackGroupModel<AmbienceTrackModel>{
    playing: boolean;
}

/** Partial update of the engine-level fields, as sent to / broadcast by the server. */
export type AmbienceEnginePatch = Partial<Pick<AmbienceEngineModel, 'playing'|'gain'|'pan'>>;
/** Partial update of one ambience track, as sent to / broadcast by the server. */
export type AmbienceTrackPatch = Partial<Pick<AmbienceTrackModel, 'gain'|'pan'|'activeInDay'|'activeAtDusk'|'activeAtNight'|'loadedResourceId'>>;

export function isAmbienceEngineModel(data: any): data is AmbienceEngineModel {
    if(typeof data !== 'object' || data === null) return false;
    if(typeof data.playing !== 'boolean') return false;
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
        activeInDay: true
    };
}

export function newAmbienceEngineModel(nTracks: number = 4): AmbienceEngineModel {
    return {
        playing: false,
        tracks: Array.from({length: nTracks}, newAmbienceTrackModel),
        gain: 1,
        pan: 0
    }
}
