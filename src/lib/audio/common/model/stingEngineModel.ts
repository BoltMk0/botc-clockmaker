import { isAudioResourceTrackModel, type AudioResourceTrackModel } from "./audioResourceTrackModel";
import { isAudioTrackGroupModel, type AudioTrackGroupModel } from "./audioTrackGroupModel.svelte";

/**
 * Shared (server-persisted) state of the sting engine: two slots that always hold a loaded asset.
 * `armedSlot` is the one that will actually fire on the next trigger, so it's always ready to play
 * instantly; the other slot is either still loading, or already loaded and waiting for its turn.
 */
export interface StingEngineModel extends AudioTrackGroupModel<AudioResourceTrackModel> {
    armedSlot: 0 | 1;
}

/** Partial update of the engine-level fields, as sent to / broadcast by the server. */
export type StingEnginePatch = Partial<Pick<StingEngineModel, 'gain' | 'pan'>>;

export function isStingEngineModel(data: any): data is StingEngineModel {
    if (typeof data !== 'object' || data === null) return false;
    if (data.armedSlot !== 0 && data.armedSlot !== 1) return false;
    if (!isAudioTrackGroupModel(data, isAudioResourceTrackModel)) return false;
    if (data.tracks.length !== 2) return false;
    return true;
}

export function newStingEngineModel(): StingEngineModel {
    return {
        armedSlot: 0,
        tracks: [
            { gain: 1, pan: 0, loadedResourceId: null },
            { gain: 1, pan: 0, loadedResourceId: null }
        ],
        gain: 1,
        pan: 0
    };
}
