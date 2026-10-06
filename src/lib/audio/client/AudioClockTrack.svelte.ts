import { bellBalanceGains } from "../common/clockSfxPreset";
import type { ClocktowerAudioTrackModel } from "../common/model/clocktowerAudioTrackModel.svelte";
import { AudioTrack } from "./AudioTrack.svelte";


export class AudioClockTrack extends AudioTrack {
    /** When set, bells never ring (used by remote-only clients). */
    silent = false;

    /** Called whenever the user edits this track's gain/pan/balance locally (e.g. via the mixer's clock
     *  channel strip), so Clocktower can sync it to the server for every other connected mixer. */
    onLocalChange: (()=>void)|null = null;

    readonly #model: ClocktowerAudioTrackModel;
    readonly #finalBellAudioSource: MediaElementAudioSourceNode;
    readonly #reminderBellAudioSource: MediaElementAudioSourceNode;
    readonly #finalBellAudio: HTMLAudioElement;
    readonly #reminderBellAudio: HTMLAudioElement;

    readonly #finalBellGainNode: GainNode;
    readonly #reminderBellGainNode: GainNode;
    /** The SFX preset's pan trim, ahead of the track's own panner. */
    readonly #sfxPanNode: StereoPannerNode;
    readonly #stopSfxSync: ()=>void;

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

        this.#sfxPanNode = context.createStereoPanner();
        this.#sfxPanNode.connect(super.input);

        this.#reminderBellAudioSource.connect(this.#reminderBellGainNode).connect(this.#sfxPanNode);
        this.#finalBellAudioSource.connect(this.#finalBellGainNode).connect(this.#sfxPanNode);

        this.persistMute(`clock.${this.id}`);
        // Keep the bells in step with the model when it's changed from elsewhere (a server update, e.g. the
        // clock's SFX preset being swapped or edited, or another mixer moving the balance).
        this.#stopSfxSync = $effect.root(()=>{
            $effect(()=>{ this.#setSource(this.#finalBellAudio, model.sfx.finalUrl); });
            $effect(()=>{ this.#setSource(this.#reminderBellAudio, model.sfx.reminderUrl); });
            $effect(()=>{ this.#sfxPanNode.pan.value = model.sfx.pan; });
            $effect(()=>{ this.#updateBellGains(); });
        });
    }

    #setSource(audio: HTMLAudioElement, url: string|null){
        console.log(`Updating bell source of Clock #${this.id} to "${url ?? ''}"`);
        if(url === null) audio.removeAttribute('src');
        else audio.src = url;
    }

    #updateBellGains(){
        const clock = bellBalanceGains(this.#model.balance);
        const preset = bellBalanceGains(this.#model.sfx.balance);
        this.#finalBellGainNode.gain.value = clock.final * preset.final * this.#model.sfx.gain;
        this.#reminderBellGainNode.gain.value = clock.reminder * preset.reminder * this.#model.sfx.gain;
    }

    get input(): AudioNode { return this.#finalBellAudioSource; }

    get gain(): number { return super.gain; }
    set gain(val: number) {
        super.gain = val;
        this.onLocalChange?.();
    }

    get pan(): number { return super.pan; }
    set pan(val: number) {
        super.pan = val;
        this.onLocalChange?.();
    }

    get balance() { return this.#model.balance; }

    set balance(balance: number) {
        this.#model.balance = balance;
        this.#updateBellGains();
        this.onLocalChange?.();
    }

    ringFinalBell(){
        console.log("Ringing final bell for clock track", this.id)
        if(this.silent || this.#model.sfx.finalUrl === null) return;
        this.#finalBellAudio.currentTime = 0;
        this.#finalBellAudio.play();
    }

    ringReminderBell(){
        if(this.silent || this.#model.sfx.reminderUrl === null) return;
        this.#reminderBellAudio.currentTime = 0;
        this.#reminderBellAudio.play();
    }

    close(): void {
        this.#stopSfxSync();
        super.close();
    }
}