import { EventEmitter } from "node:events";
import { AmbienceTrackHelper } from "./AmbienceTrackHelper";
import { newAmbienceEngineModel, type AmbienceEngineModel } from "$lib/audio/common/model/ambienceEngineModel";
import type { AmbienceTrackModel } from "$lib/audio/common/model/ambienceTrackModel";
import { loadAmbienceEngineModelFromResources } from "$lib/resources/server/ambience-engine-config";

export class AmbienceEngineHelper extends EventEmitter {
    #model: AmbienceEngineModel;
    #tracks: AmbienceTrackHelper[];
    constructor(model: AmbienceEngineModel){
        super();
        this.#model = model;
        this.#tracks = this.#model.tracks.map((t, i)=>this.setupTrackHelper(t, i));
    }

    private setupTrackHelper(model: AmbienceTrackModel, helperIndex?: number): AmbienceTrackHelper {
        const helper = new AmbienceTrackHelper(model);
        if(helperIndex === undefined) helperIndex = this.#tracks.length;
        helper.on('change', (model)=>{
            this.emit('trackUpdate', helperIndex, model);
        });
        return helper;
    }

    on(eventName: 'engineUpdate', listener: (model: AmbienceEngineModel)=>void): this;
    on(eventName: 'trackUpdate', listener: (index: number, model: AmbienceTrackModel)=>void): this;
    on(eventName: string | symbol, listener: (...args: any[]) => void): this {
        return super.on(eventName, listener);
    }

    get tracks(){ return this.#tracks; }
    get model() { return this.#model; }
    get gain() { return this.#model.gain; }
    
    set gain(gain: number) {
        this.#model.gain = Math.max(0, gain);
        this.emit('engineUpdate', this.#model);
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
