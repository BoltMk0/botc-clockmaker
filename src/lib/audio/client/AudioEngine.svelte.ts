import type { Clocktower } from "$lib/model/client/Clocktower.svelte";
import type { TimeOfDay } from "$lib/model/client/types";
import { AmbienceEngine } from "../../audio/client/AmbienceEngine.svelte";
import type { AmbienceEngineModel } from "../common/model/ambienceEngineModel";
import type { AudioTrackModel } from "../common/model/audioTrackModel.svelte";
import { AudioClockTrack } from "./AudioClockTrack.svelte";
import { type AudioTrackBase } from "./AudioTrack.svelte";


export class AudioEngine implements AudioTrackBase {
    #context: AudioContext;

    #model: AudioTrackModel = $state({gain: 1.0, pan: 0.0})
    #gainNode: GainNode;

    #clockAudioTracks: AudioClockTrack[];
    #ambienceEngineModel: AmbienceEngineModel|null;
    #ambienceEngine: AmbienceEngine|null;
    #timeOfDay: TimeOfDay;

    constructor(clocks: Clocktower[], ambienceEngineModel?: AmbienceEngineModel){
        this.#context = new AudioContext();
        this.#gainNode = this.#context.createGain();
        this.#gainNode.gain.value = 1;
        this.#gainNode.connect(this.#context.destination);
        console.log("Connection", clocks.length, "clocks")
        this.#clockAudioTracks = clocks.map(c=>c.connectAudio(this.#gainNode));
        this.#timeOfDay = $derived(clocks.reduce((tod, clock)=>{
            if(clock.timeOfDay === 'day') return 'day'
            return tod;
        }, 'night' as TimeOfDay));
        this.#ambienceEngineModel = $state(ambienceEngineModel ?? null)
        this.#ambienceEngine = this.#ambienceEngineModel ? new AmbienceEngine(this.#ambienceEngineModel, this.#gainNode, this.#timeOfDay) : null;
        this.#gainNode.connect(this.#context.destination);
        this.#context.resume();
    }

    resume(){ this.#context.resume(); }

    get clockAudioTracks(){ return this.#clockAudioTracks; }
    get ambienceEngine(){ return this.#ambienceEngine; }
    get timeOfDay(){ return this.#timeOfDay; }

    get gain(){ return this.#model.gain; }
    set gain(value: number){ 
        this.#model.gain = Math.max(0, value);
        this.#gainNode.gain.value = this.#model.gain; 
    }

    get input(){ return this.#gainNode; }

    get pan(){ return 0; }
    set pan(value: number){ return; }

    close(): void {
        for(const clock of this.#clockAudioTracks){
            clock.close();
        }
        this.#ambienceEngine?.close();
        this.#context.close();
    }
}
