import type { AmbienceTrackPatch } from "$lib/audio/common/model/ambienceEngineModel";
import type { AmbienceTrackModel } from "$lib/audio/common/model/ambienceTrackModel";
import { findResourceById } from "$lib/resources/server/resources";

export class AmbienceTrackHelper {
    #model: AmbienceTrackModel;

    constructor(model: AmbienceTrackModel){
        this.#model = model;
    }

    get model(){ return this.#model; }

    /** Validates and applies a patch. Returns false if nothing changed; throws on an invalid field. */
    applyPatch(patch: Record<string, unknown>): boolean {
        const m = this.#model;
        const clean: AmbienceTrackPatch = {};
        if(patch.gain !== undefined){
            if(typeof patch.gain !== 'number' || isNaN(patch.gain)) throw new Error('Invalid gain');
            clean.gain = Math.min(4, Math.max(0, patch.gain));
        }
        if(patch.pan !== undefined){
            if(typeof patch.pan !== 'number' || isNaN(patch.pan)) throw new Error('Invalid pan');
            clean.pan = Math.min(1, Math.max(-1, patch.pan));
        }
        if(patch.activeInDay !== undefined){
            if(typeof patch.activeInDay !== 'boolean') throw new Error('Invalid activeInDay');
            clean.activeInDay = patch.activeInDay;
        }
        if(patch.activeAtNight !== undefined){
            if(typeof patch.activeAtNight !== 'boolean') throw new Error('Invalid activeAtNight');
            clean.activeAtNight = patch.activeAtNight;
        }
        if(patch.loadedResourceId !== undefined){
            if(patch.loadedResourceId !== null){
                if(typeof patch.loadedResourceId !== 'string' || findResourceById(patch.loadedResourceId) === null){
                    throw new Error('No such resource');
                }
            }
            clean.loadedResourceId = patch.loadedResourceId;
        }
        let changed = false;
        for(const key of Object.keys(clean) as (keyof AmbienceTrackPatch)[]){
            if(m[key] !== clean[key]){
                (m as any)[key] = clean[key];
                changed = true;
            }
        }
        return changed;
    }
}
