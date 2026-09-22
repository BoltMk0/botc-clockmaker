import { EventEmitter } from "node:events";
import { newStingEngineModel, type StingEngineModel } from "$lib/audio/common/model/stingEngineModel";
import type { AudioResourceTrackModel } from "$lib/audio/common/model/audioResourceTrackModel";
import { loadStingEngineModelFromResources, saveStingEngineModel } from "$lib/resources/server/sting-engine-config";
import { listResources } from "$lib/resources/server/resources";

const SAVE_DEBOUNCE_MS = 2000;

/** Picks a random sting resource id from the library, or null if none are uploaded yet. */
function pickRandomStingResourceId(): string | null {
    const resources = listResources('sting');
    if (resources.length === 0) return null;
    return resources[Math.floor(Math.random() * resources.length)].id;
}

export class StingEngineHelper extends EventEmitter {
    #model: StingEngineModel;
    #saveTimeout: ReturnType<typeof setTimeout> | null = null;

    constructor(model: StingEngineModel) {
        super();
        this.#model = model;
        // Make sure both slots start with something armed and ready, if the library has anything in it.
        for (const track of this.#model.tracks) {
            if (track.loadedResourceId === null) track.loadedResourceId = pickRandomStingResourceId();
        }
    }

    on(eventName: 'engineUpdate', listener: (model: StingEngineModel) => void): this;
    on(eventName: 'trackUpdate', listener: (index: number, model: AudioResourceTrackModel) => void): this;
    on(eventName: 'trigger', listener: (slot: 0 | 1) => void): this;
    on(eventName: string | symbol, listener: (...args: any[]) => void): this {
        return super.on(eventName, listener);
    }

    get model() { return this.#model; }

    private scheduleSave() {
        if (this.#saveTimeout) clearTimeout(this.#saveTimeout);
        this.#saveTimeout = setTimeout(() => {
            this.#saveTimeout = null;
            try {
                saveStingEngineModel(this.#model);
            } catch (e) {
                console.error("Failed to save sting engine model", e);
            }
        }, SAVE_DEBOUNCE_MS);
    }

    /** Validates and applies an engine-level patch (gain / pan). Throws on an invalid field. */
    updateEngine(patch: Record<string, unknown>) {
        const m = this.#model;
        let changed = false;
        if (patch.gain !== undefined) {
            if (typeof patch.gain !== 'number' || isNaN(patch.gain)) throw new Error('Invalid gain');
            const gain = Math.max(0, patch.gain);
            if (m.gain !== gain) { m.gain = gain; changed = true; }
        }
        if (patch.pan !== undefined) {
            if (typeof patch.pan !== 'number' || isNaN(patch.pan)) throw new Error('Invalid pan');
            const pan = Math.min(1, Math.max(-1, patch.pan));
            if (m.pan !== pan) { m.pan = pan; changed = true; }
        }
        if (changed) {
            this.emit('engineUpdate', m);
            this.scheduleSave();
        }
    }

    /**
     * Fires whichever slot is currently armed (broadcast to clients, which each play back whatever they
     * already have loaded there), then immediately arms the other slot with a fresh random pick and swaps
     * which slot will fire next time.
     */
    trigger() {
        const firedSlot = this.#model.armedSlot;
        this.emit('trigger', firedSlot);

        const nextResourceId = pickRandomStingResourceId();
        this.#model.tracks[firedSlot].loadedResourceId = nextResourceId;
        this.emit('trackUpdate', firedSlot, this.#model.tracks[firedSlot]);

        this.#model.armedSlot = firedSlot === 0 ? 1 : 0;
        this.emit('engineUpdate', this.#model);
        this.scheduleSave();
    }
}


var instance: StingEngineHelper;

export function getStingEngineHelperInstance() {
    if (instance === undefined) {
        let model = loadStingEngineModelFromResources();
        if (model === null) {
            model = newStingEngineModel();
        }
        instance = new StingEngineHelper(model);
    }
    return instance;
}
