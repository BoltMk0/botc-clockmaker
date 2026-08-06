import type { AmbienceTrackModel } from "$lib/audio/common/model/ambienceTrackModel";
import EventEmitter from "node:events";

export class AmbienceTrackHelper extends EventEmitter {
    #model: AmbienceTrackModel;

    constructor(model: AmbienceTrackModel){
        super();
        this.#model = model;
    }

    on(eventName: 'change', listener: (model: AmbienceTrackModel)=>void): this;
    on(eventName: string, listener: (...args: any[])=>void): this {
        return super.on(eventName, listener);
    }

    get gain(){ return this.#model.gain; }
    get pan() { return this.#model.pan;  }
    get activeInDay() { return this.#model.activeInDay; }
    get activeAtNight() { return this.#model.activeAtNight; }
    get resourceId() { return this.#model.loadedResourceId; }

    set gain(gain: number){
        this.#model.gain = Math.min(4, Math.max(0, gain));
        this.emit('change', this.#model);
    }

    set pan(pan: number){
        this.#model.pan = Math.min(1, Math.max(-1, pan));
        this.emit('change', this.#model);
    }

    set activeInDay(active: boolean){
        this.#model.activeInDay = active;
        this.emit('change', this.#model);
    }

    set activeAtNight(active: boolean){
        this.#model.activeAtNight = active;
        this.emit('change', this.#model);
    }

    set loadedResourceId(newId: string) {
        this.#model.loadedResourceId = newId;
        this.emit('change', this.#model);
    }
}