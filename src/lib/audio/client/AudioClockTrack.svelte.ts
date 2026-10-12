import { bellBalanceGains, CLOCK_SFX_SLOTS, type ClockSfxSlot } from "../common/clockSfxPreset";
import type { ClocktowerAudioTrackModel } from "../common/model/clocktowerAudioTrackModel.svelte";
import { AudioTrack } from "./AudioTrack.svelte";


export class AudioClockTrack extends AudioTrack {
    /** When set, bells never ring (used by remote-only clients). */
    silent = false;

    /** Called whenever the user edits this track's gain/pan/balance locally (e.g. via the mixer's clock
     *  channel strip), so Clocktower can sync it to the server for every other connected mixer. */
    onLocalChange: (()=>void)|null = null;

    readonly #model: ClocktowerAudioTrackModel;
    readonly #bells: Record<ClockSfxSlot, { audio: HTMLAudioElement, source: MediaElementAudioSourceNode, gainNode: GainNode }>;
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

        this.#sfxPanNode = context.createStereoPanner();
        this.#sfxPanNode.connect(super.input);

        const createBell = () => {
            const audio = new Audio();
            audio.onerror = ()=>{
                console.error(`AudioTrackModel ${this.id} - ERROR: ${audio.error?.message ?? "unknown error"}`);
            }
            audio.onloadstart = ()=>{
                console.debug(`AudioTrackModel ${this.id} - Loading audio: ${audio.src}`);
            }
            audio.onloadeddata = ()=>{
                console.debug(`AudioTrackModel ${this.id} - Finished loading audio. Duration ${audio.duration}s`);
            }
            audio.onended = ()=>{
                console.debug(`AudioTrackModel ${this.id} - playback ended`);
            };
            audio.onplaying = ()=>{
                console.debug(`AudioTrackModel ${this.id} - Is playing`, audio.src);
            };
            const source = context.createMediaElementSource(audio);
            const gainNode = context.createGain();
            source.connect(gainNode).connect(this.#sfxPanNode);
            return { audio, source, gainNode };
        };
        this.#bells = { start: createBell(), final: createBell(), reminder: createBell() };

        this.persistMute(`clock.${this.id}`);
        // Keep the bells in step with the model when it's changed from elsewhere (a server update, e.g. the
        // clock's SFX preset being swapped or edited, or another mixer moving the balance).
        this.#stopSfxSync = $effect.root(()=>{
            $effect(()=>{ this.#setSource(this.#bells.start.audio, model.sfx.startUrl); });
            $effect(()=>{ this.#setSource(this.#bells.final.audio, model.sfx.finalUrl); });
            $effect(()=>{ this.#setSource(this.#bells.reminder.audio, model.sfx.reminderUrl); });
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
        for(const slot of CLOCK_SFX_SLOTS){
            this.#bells[slot].gainNode.gain.value = clock[slot] * preset[slot] * this.#model.sfx.gain;
        }
    }

    get input(): AudioNode { return this.#bells.final.source; }

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

    #ring(slot: ClockSfxSlot, url: string|null){
        if(this.silent || url === null) return;
        const audio = this.#bells[slot].audio;
        audio.currentTime = 0;
        audio.play();
    }

    /** When the game goes from night to day. */
    ringStartOfDay(){ this.#ring('start', this.#model.sfx.startUrl); }

    /** When the timer runs out, or the bell is rung by hand. */
    ringEndOfDay(){
        console.log("Ringing end of day bell for clock track", this.id)
        this.#ring('final', this.#model.sfx.finalUrl);
    }

    ringReminderBell(){ this.#ring('reminder', this.#model.sfx.reminderUrl); }

    close(): void {
        this.#stopSfxSync();
        super.close();
    }
}