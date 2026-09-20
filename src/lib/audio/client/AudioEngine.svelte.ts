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
    #muted = $state(false);
    #analyser: AnalyserNode;

    #clockAudioTracks: AudioClockTrack[];
    #ambienceEngineModel: AmbienceEngineModel|null;
    #ambienceEngine: AmbienceEngine|null;
    #timeOfDay: TimeOfDay;

    constructor(clocks: Clocktower[], ambienceEngineModel?: AmbienceEngineModel){
        this.#context = new AudioContext();
        this.#gainNode = this.#context.createGain();
        this.#gainNode.gain.value = 1;
        this.#gainNode.connect(this.#context.destination);
        this.#analyser = this.#context.createAnalyser();
        this.#gainNode.connect(this.#analyser);
        console.log("Connection", clocks.length, "clocks")
        this.#clockAudioTracks = clocks.map(c=>c.connectAudio(this.#gainNode));
        // With several games each in their own day/night phase, daytime wins: it's day if any game is in daytime.
        this.#timeOfDay = $derived(clocks.some(clock=>clock.timeOfDay === 'day') ? 'day' : 'night');
        this.#ambienceEngineModel = $state(ambienceEngineModel ?? null)
        this.#ambienceEngine = this.#ambienceEngineModel ? new AmbienceEngine(this.#ambienceEngineModel, this.#gainNode, ()=>this.#timeOfDay) : null;
        this.#context.resume();
    }

    resume(){
        this.#context.resume();
        // Media element playback may have been blocked by the autoplay policy until this gesture.
        this.#ambienceEngine?.retryPlayback();
    }

    get clockAudioTracks(){ return this.#clockAudioTracks; }
    get ambienceEngine(){ return this.#ambienceEngine; }
    get timeOfDay(){ return this.#timeOfDay; }

    get muted(){ return this.#muted; }
    set muted(value: boolean){
        this.#muted = value;
        this.#gainNode.gain.value = value ? 0 : this.#model.gain;
    }

    get gain(){ return this.#model.gain; }
    set gain(value: number){
        this.#model.gain = Math.max(0, value);
        this.#gainNode.gain.value = this.#muted ? 0 : this.#model.gain;
    }

    get input(){ return this.#gainNode; }
    get analyser(){ return this.#analyser; }

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
