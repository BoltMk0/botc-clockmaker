import type { AmbienceTrackModel } from "$lib/audio/common/model/ambienceTrackModel";
import type { Resource } from "$lib/resources/common/types";
import { AudioTrack } from "./AudioTrack.svelte";

export class AudioAmbienceTrack extends AudioTrack {
    readonly audioSource: MediaElementAudioSourceNode;
    readonly audio: HTMLAudioElement;
    readonly #model: AmbienceTrackModel; 

    constructor(
        model: AmbienceTrackModel,
        outputNode: AudioNode,
        title: string
    ) {
        super(model, outputNode, title);
        this.#model = model;
        this.audio = new Audio();

        this.audio.onerror = ()=>{
            console.error(`AudioAmbienceTrack - ERROR: ${this.audio.error?.message ?? "unknown error"}`);
        }
        this.audio.onloadstart = (ev)=>{
            console.debug(`AudioAmbienceTrack - Loading audio: ${this.audio.src}`);
        }
        this.audio.onloadeddata = (ev)=>{
            console.debug(`AudioAmbienceTrack - Finished loading audio. Duration ${this.audioSource.mediaElement.duration}s`);
        }
        this.audio.onended = (()=>{
            console.debug(`AudioAmbienceTrack - playback ended`);
        });
        this.audio.onplaying = (()=>{
            console.debug(`AudioAmbienceTrack - Is playing`, this.audio.src);
        });

        this.audio.loop = true;
        
        const context = (outputNode.context as AudioContext);
        this.audioSource = context.createMediaElementSource(this.audio);

        this.audioSource.connect(this.input);

        this.loadedResourceId = this.#model.loadedResourceId; // Trigger load
    }

    get activeAtNight(): boolean { return this.#model.activeAtNight; }
    set activeAtNight(value: boolean){ this.#model.activeAtNight = value; }
    
    get activeInDay(): boolean { return this.#model.activeInDay; }
    set activeInDay(value: boolean){ this.#model.activeInDay = value; }

    get loadedResourceId(): string|null { return this.#model.loadedResourceId; }
    set loadedResourceId(res: string|null) { 
        this.#model.loadedResourceId = res;
        this.audio.src = this.#model.loadedResourceId === null ? '' : `/api/resources/${this.#model.loadedResourceId}`;
    }

    play(){
        this.audio.currentTime = this.audio.duration * Math.random();
        this.audio.play();
    }

    stop(){
        this.audio.pause();
    }

    close(): void {
        super.close();
    }
}