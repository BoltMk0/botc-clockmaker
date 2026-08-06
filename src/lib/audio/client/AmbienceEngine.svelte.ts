import { AudioAmbienceTrack } from "$lib/audio/client/AudioAmbienceTrack.svelte";
import { AudioTrackGroup } from "$lib/audio/client/AudioTrackGroup";
import type { AmbienceEngineModel } from "$lib/audio/common/model/ambienceEngineModel";
import type { AmbienceTrackModel } from "$lib/audio/common/model/ambienceTrackModel";
import type { TimeOfDay } from "../../model/client/types";
import { SSEClient } from "../../model/client/util/sseClient.svelte";

export class AmbienceEngine extends AudioTrackGroup<AudioAmbienceTrack> {

    #model: AmbienceEngineModel;
    #sseConnection: SSEClient;
    
    constructor(
        model: AmbienceEngineModel,
        outputNode: AudioNode,
        timeOfDay: TimeOfDay
    ) {
        super(
            model, 
            outputNode, '',
            (model: AmbienceTrackModel, outputNode: AudioNode, index: number)=>new AudioAmbienceTrack(model, outputNode, `Track ${index + 1}`)
        );
        this.#model = $state(model);
        this.#sseConnection = new SSEClient('/api/ambienceEngine/events', (msg)=>{
            // TODO: Handle ambience engine messages
            switch(msg.type){
                case 'ambienceEngineUpdate':
                    this.#model = msg.model;
                    break;
                case 'ambienceTrackUpdate':
                    if(msg.index < this.#model.tracks.length && msg.index >= 0){
                        this.#model.tracks[msg.index] = msg.model;
                    }
                    break;
                default:
                    break;
            }
        });
    }
    get model() { return this.#model; }
    get timeOfDay(){ return this.model.timeOfDay; }
    get playing() { return this.model.playing; }

    set playing(playing: boolean){
        this.#model.playing = playing;
        if(!playing) {
            for(const t of this.tracks){
                t.stop();
            }
            return;
        };
        for(const t of this.tracks){
            if(this.timeOfDay === 'day' && t.activeInDay){
                t.play();
            } else if(this.timeOfDay === 'night' && t.activeAtNight){
                t.play();
            } else {
                t.stop();
            }
        }
    }

    play(){
        this.model.playing = true;
    }

    pause(){
        this.model.playing = false;
    }

    togglePlayPause() {
        this.model.playing = !this.model.playing;
    }
}

