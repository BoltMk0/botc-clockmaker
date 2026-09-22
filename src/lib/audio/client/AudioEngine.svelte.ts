import type { Clocktower } from "$lib/model/client/Clocktower.svelte";
import type { TimeOfDay } from "$lib/model/client/types";
import { AmbienceEngine } from "../../audio/client/AmbienceEngine.svelte";
import type { AmbienceEngineModel } from "../common/model/ambienceEngineModel";
import type { AudioTrackModel } from "../common/model/audioTrackModel.svelte";
import { AudioClockTrack } from "./AudioClockTrack.svelte";
import { type AudioTrackBase } from "./AudioTrack.svelte";
import { AudioDim } from "./AudioDim.svelte";
import { StingEngine } from "./StingEngine.svelte";
import type { StingEngineModel } from "../common/model/stingEngineModel";

/** Time constant of the dim ramp: settles in roughly half a second, without clicks. */
const DIM_TIME_CONSTANT_S = 0.12;

const MUTE_STORAGE_KEY = 'mixer.mute.master';

export class AudioEngine implements AudioTrackBase {
    #context: AudioContext;

    #model: AudioTrackModel = $state({gain: 1.0, pan: 0.0})
    #gainNode: GainNode;
    #dimNode: GainNode; // After the master fader, so dimming never fights the user's gain
    #dim: AudioDim|null = null;
    #stopEffects: (()=>void)|null = null;
    #muted = $state(false);
    #analyser: AnalyserNode;

    #clockAudioTracks: AudioClockTrack[];
    #ambienceEngineModel: AmbienceEngineModel|null;
    #ambienceEngine: AmbienceEngine|null;
    #stingEngineModel: StingEngineModel|null;
    #stingEngine: StingEngine|null;
    #timeOfDay: TimeOfDay;
    readonly #silent: boolean;

    /**
     * @param options.silent Nothing ever plays on this client: the output isn't connected, ambience never starts and
     *   bells never ring. The mixer controls still work, editing the shared state for other clients.
     */
    constructor(clocks: Clocktower[], ambienceEngineModel?: AmbienceEngineModel, stingEngineModel?: StingEngineModel, options: {silent?: boolean} = {}){
        this.#silent = options.silent ?? false;
        this.#context = new AudioContext();
        this.#gainNode = this.#context.createGain();
        this.#gainNode.gain.value = 1;
        this.#dimNode = this.#context.createGain();
        this.#gainNode.connect(this.#dimNode);
        if(!this.#silent) this.#dimNode.connect(this.#context.destination);
        this.#analyser = this.#context.createAnalyser();
        this.#gainNode.connect(this.#analyser);
        console.log("Connection", clocks.length, "clocks")
        this.#clockAudioTracks = clocks.map(c=>c.connectAudio(this.#gainNode));
        if(this.#silent) this.#clockAudioTracks.forEach(t=>t.silent = true);
        // With several games each in their own day/night phase, daytime wins: it's day if any game is in daytime.
        this.#timeOfDay = $derived(clocks.some(clock=>clock.timeOfDay === 'day') ? 'day' : 'night');
        this.#ambienceEngineModel = $state(ambienceEngineModel ?? null)
        this.#ambienceEngine = this.#ambienceEngineModel ? new AmbienceEngine(this.#ambienceEngineModel, this.#gainNode, ()=>this.#timeOfDay, {silent: this.#silent}) : null;
        this.#stingEngineModel = $state(stingEngineModel ?? null)
        this.#stingEngine = this.#stingEngineModel ? new StingEngine(this.#stingEngineModel, this.#gainNode, {silent: this.#silent}) : null;
        try {
            this.muted = localStorage.getItem(MUTE_STORAGE_KEY) === '1';
        } catch { /* storage unavailable */ }
        if(!this.#silent){
            // Follow the shared dim (a silent client plays nothing, so has nothing to dim)
            const dim = this.#dim = new AudioDim();
            this.#stopEffects = $effect.root(()=>{
                $effect(()=>{
                    this.#dimNode.gain.setTargetAtTime(dim.gain, this.#context.currentTime, DIM_TIME_CONSTANT_S);
                });
            });
            this.#context.resume();
        }
    }

    resume(){
        if(this.#silent) return;
        this.#context.resume();
        // Media element playback may have been blocked by the autoplay policy until this gesture.
        this.#ambienceEngine?.retryPlayback();
    }

    get clockAudioTracks(){ return this.#clockAudioTracks; }
    get ambienceEngine(){ return this.#ambienceEngine; }
    get stingEngine(){ return this.#stingEngine; }
    get timeOfDay(){ return this.#timeOfDay; }

    get muted(){ return this.#muted; }
    set muted(value: boolean){
        this.#muted = value;
        this.#gainNode.gain.value = value ? 0 : this.#model.gain;
        try {
            if(value) localStorage.setItem(MUTE_STORAGE_KEY, '1');
            else localStorage.removeItem(MUTE_STORAGE_KEY);
        } catch { /* storage unavailable; mute just won't persist */ }
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
        this.#stopEffects?.();
        this.#dim?.close();
        this.#ambienceEngine?.close();
        this.#stingEngine?.close();
        this.#context.close();
    }
}
