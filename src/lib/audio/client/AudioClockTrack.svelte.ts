import type { Config } from "$lib/common/config";
import type { ClocktowerAudioTrackModel } from "../common/model/clocktowerAudioTrackModel.svelte";
import { AudioTrack } from "./AudioTrack.svelte";

function resourceToUrl(res: string|null){
    return res === null ? '' : `/api/resources/${res}`
}
    
export class AudioClockTrack extends AudioTrack {
    readonly #model: ClocktowerAudioTrackModel;
    readonly #finalBellAudioSource: MediaElementAudioSourceNode;
    readonly #reminderBellAudioSource: MediaElementAudioSourceNode;
    readonly #finalBellAudio: HTMLAudioElement;
    readonly #reminderBellAudio: HTMLAudioElement;

    readonly #finalBellGainNode: GainNode;
    readonly #reminderBellGainNode: GainNode;

    constructor(
        readonly id: string,
        model: ClocktowerAudioTrackModel,
        title: string,
        outputNode: AudioNode
    ) {
        console.debug("Setting up new AudioClockTrack", model);
        super(model, outputNode, title);
        this.#model = model;

        let context = outputNode.context as AudioContext;

        this.#reminderBellAudio = new Audio();
        this.#finalBellAudio = new Audio();

        this.#reminderBellAudio.onerror = ()=>{
            console.error(`AudioTrackModel ${this.id} - ERROR: ${this.#reminderBellAudio.error?.message ?? "unknown error"}`);
        }
        this.#reminderBellAudio.onloadstart = (ev)=>{
            console.debug(`AudioTrackModel ${this.id} - Loading audio: ${this.#reminderBellAudio.src}`);
        }
        this.#reminderBellAudio.onloadeddata = (ev)=>{
            console.debug(`AudioTrackModel ${this.id} - Finished loading audio. Duration ${this.#reminderBellAudioSource.mediaElement.duration}s`);
        }
        this.#reminderBellAudio.onended = (()=>{
            console.debug(`AudioTrackModel ${this.id} - playback ended`);
        });
        this.#reminderBellAudio.onplaying = (()=>{
            console.debug(`AudioTrackModel ${this.id} - Is playing`, this.#reminderBellAudio.src);
        });
        
        this.#finalBellAudio.onerror = ()=>{
            console.error(`AudioTrackModel ${this.id} - ERROR: ${this.#finalBellAudio.error?.message ?? "unknown error"}`);
        }
        this.#finalBellAudio.onloadstart = (ev)=>{
            console.debug(`AudioTrackModel ${this.id} - Loading audio: ${this.#finalBellAudio.src}`);
        }
        this.#finalBellAudio.onloadeddata = (ev)=>{
            console.debug(`AudioTrackModel ${this.id} - Finished loading audio. Duration ${this.#finalBellAudioSource.mediaElement.duration}s`);
        }
        this.#finalBellAudio.onended = (()=>{
            console.debug(`AudioTrackModel ${this.id} - playback ended`);
        });
        this.#finalBellAudio.onplaying = (()=>{
            console.debug(`AudioTrackModel ${this.id} - Is playing`, this.#finalBellAudio.src);
        });

        this.#reminderBellAudioSource = context.createMediaElementSource(this.#reminderBellAudio);
        this.#finalBellAudioSource = context.createMediaElementSource(this.#finalBellAudio);

        this.#finalBellGainNode = context.createGain();
        this.#reminderBellGainNode = context.createGain();

        this.#reminderBellAudioSource.connect(this.#reminderBellGainNode).connect(super.input);
        this.#finalBellAudioSource.connect(this.#finalBellGainNode).connect(super.input);

        this.balance = model.balance; // Trigger update of final/reminder bell gains
        this.reminderBellResourceId = this.reminderBellResourceId;
        this.finalBellResourceId = this.finalBellResourceId;
    }

    get input(): AudioNode { return this.#finalBellAudioSource; }

    get balance() { return this.#model.balance; }
    
    set balance(balance: number) {
        this.#model.balance = balance;
        const finalGain = this.#model.balance > 0 ?  1 : Math.sin(Math.PI/2 * (1 + this.#model.balance));
        const reminderGain = this.#model.balance < 0 ?  1 : Math.sin(Math.PI/2 * (1 - this.#model.balance));
        this.#finalBellGainNode.gain.value = finalGain;
        this.#reminderBellGainNode.gain.value = reminderGain;
    }

    get reminderBellResourceId(){ return this.#model.resources.reminderBell; }
    get finalBellResourceId(){ return this.#model.resources.finalBell; }
    set reminderBellResourceId(id: string|null){
        this.#model.resources.reminderBell = id;
        const url = resourceToUrl(this.#model.resources.reminderBell);
        console.log(`Updating reminder bell source of Clock #${this.id} to "${url}" (resid=${id})`);
        this.#reminderBellAudio.src = url;
    }
    set finalBellResourceId(id: string|null){
        this.#model.resources.finalBell = id;
        const url = resourceToUrl(this.#model.resources.finalBell);
        console.log(`Updating final bell source of Clock #${this.id} to "${url}" (resid=${id})`);
        this.#finalBellAudio.src = url;
    }

    ringFinalBell(){
        console.log("Ringing final bell for clock track", this.id)
        if(this.#finalBellAudio.src === '') return;
        this.#finalBellAudio.currentTime = 0;
        this.#finalBellAudio.play();
    }

    ringReminderBell(){
        if(this.#reminderBellAudio.src === '') return;
        this.#reminderBellAudio.currentTime = 0;
        this.#reminderBellAudio.play();
    }

    close(): void {
        super.close();
    }
}