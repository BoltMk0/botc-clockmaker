import { EventEmitter } from "node:events";
import { AmbienceTrackHelper } from "./AmbienceTrackHelper";
import { MAX_AMBIENCE_TRACKS, newAmbienceEngineModel, newAmbienceTrackModel, type AmbienceEngineModel } from "$lib/audio/common/model/ambienceEngineModel";
import type { AmbienceTrackModel } from "$lib/audio/common/model/ambienceTrackModel";
import { loadAmbienceEngineModelFromResources, saveAmbienceEngineModel } from "$lib/resources/server/ambience-engine-config";

const SAVE_DEBOUNCE_MS = 2000;

export class AmbienceEngineHelper extends EventEmitter {
    #model: AmbienceEngineModel;
    #tracks: AmbienceTrackHelper[];
    #saveTimeout: ReturnType<typeof setTimeout> | null = null;

    constructor(model: AmbienceEngineModel){
        super();
        this.#model = model;
        this.#tracks = this.#model.tracks.map(t=>new AmbienceTrackHelper(t));
    }

    on(eventName: 'engineUpdate', listener: (model: AmbienceEngineModel)=>void): this;
    on(eventName: 'trackUpdate', listener: (index: number, model: AmbienceTrackModel)=>void): this;
    on(eventName: 'trackRemoved', listener: (index: number)=>void): this;
    on(eventName: string | symbol, listener: (...args: any[]) => void): this {
        return super.on(eventName, listener);
    }

    get tracks(){ return this.#tracks; }
    get model() { return this.#model; }

    /** Debounced persistence, so dragging a slider doesn't write to disk on every event. */
    private scheduleSave(){
        if(this.#saveTimeout) clearTimeout(this.#saveTimeout);
        this.#saveTimeout = setTimeout(()=>{
            this.#saveTimeout = null;
            try {
                saveAmbienceEngineModel(this.#model);
            } catch (e) {
                console.error("Failed to save ambience engine model", e);
            }
        }, SAVE_DEBOUNCE_MS);
    }

    /** Validates and applies an engine-level patch (playing / gain / pan). Throws on an invalid field. */
    updateEngine(patch: Record<string, unknown>){
        const m = this.#model;
        let changed = false;
        if(patch.playing !== undefined){
            if(typeof patch.playing !== 'boolean') throw new Error('Invalid playing');
            if(m.playing !== patch.playing){ m.playing = patch.playing; changed = true; }
        }
        if(patch.gain !== undefined){
            if(typeof patch.gain !== 'number' || isNaN(patch.gain)) throw new Error('Invalid gain');
            const gain = Math.max(0, patch.gain);
            if(m.gain !== gain){ m.gain = gain; changed = true; }
        }
        if(patch.pan !== undefined){
            if(typeof patch.pan !== 'number' || isNaN(patch.pan)) throw new Error('Invalid pan');
            const pan = Math.min(1, Math.max(-1, patch.pan));
            if(m.pan !== pan){ m.pan = pan; changed = true; }
        }
        if(changed){
            this.emit('engineUpdate', m);
            this.scheduleSave();
        }
    }

    /** Validates and applies a patch to one track. Throws on an invalid field or index. */
    updateTrack(index: number, patch: Record<string, unknown>){
        const track = this.#tracks[index];
        if(!track) throw new Error('Invalid track index - out of range');
        if(track.applyPatch(patch)){
            this.emit('trackUpdate', index, track.model);
            this.scheduleSave();
        }
    }

    /** Appends a new empty track. Clients pick it up from the engine update (they append any tracks they're missing). */
    addTrack(){
        if(this.#model.tracks.length >= MAX_AMBIENCE_TRACKS) throw new Error(`At most ${MAX_AMBIENCE_TRACKS} ambience tracks`);
        const model = newAmbienceTrackModel();
        this.#model.tracks.push(model);
        this.#tracks.push(new AmbienceTrackHelper(model));
        this.emit('engineUpdate', this.#model);
        this.scheduleSave();
    }

    /**
     * Removes one track, shifting the later ones down an index. Announced with its own event rather than an engine
     * update, so clients drop exactly that track - matching on count alone would leave the later tracks each taking
     * on the next one's settings (and reloading its audio).
     */
    removeTrack(index: number){
        if(!this.#tracks[index]) throw new Error('Invalid track index - out of range');
        this.#model.tracks.splice(index, 1);
        this.#tracks.splice(index, 1);
        this.emit('trackRemoved', index);
        this.scheduleSave();
    }
}


var instance: AmbienceEngineHelper;

export function getAmbienceEngineHelperInstance(){
    if(instance === undefined){
        // First check for existing instances
        let model = loadAmbienceEngineModelFromResources();
        if(model === null){
            model = newAmbienceEngineModel(4);
        }
        instance = new AmbienceEngineHelper(model);
    }
    return instance;
}
