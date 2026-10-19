import type { AudioTrackModel } from "../common/model/audioTrackModel.svelte";
import { createMeterFold, QuadPanner } from "./QuadPanner";

export interface AudioTrackBase {
    get input(): AudioNode;
    /** Post-fader tap for level metering. */
    get analyser(): AnalyserNode;

    gain: number;
    pan: number;
    /** Silences the track without touching its gain. Local to this device. */
    muted: boolean;

    close(): void;
}

export class AudioTrack implements AudioTrackBase {
    private gainNode: GainNode;
    readonly #input: AudioNode;
    readonly #setPan: (value: number)=>void;
    readonly #quad: QuadPanner|null;
    readonly #analyser: AnalyserNode;
    readonly #disconnect: ()=>void;
    readonly #model: AudioTrackModel;
    #muted = $state(false);
    #muteStorageKey: string|null = null;

    /**
     * @param options.quad Carry four channels (4.0) rather than stereo, panning the front and rear pairs alike, with a
     *   level for each pair (see `quad`).
     */
    constructor(
        model: AudioTrackModel,
        outputNode:     AudioNode, 
        readonly title: string,
        options: {quad?: boolean} = {}
    ) {
        const context = outputNode.context;
        
        this.#model = model
        this.gainNode = context.createGain();
        this.gainNode.gain.value = model.gain;
        this.#analyser = context.createAnalyser();
        if(options.quad){
            const quad = this.#quad = new QuadPanner(context);
            quad.pan = model.pan;
            quad.output.connect(this.gainNode).connect(outputNode);
            this.#input = quad.input;
            this.#setPan = (value)=>{ quad.pan = value; };
            const fold = createMeterFold(context);
            this.gainNode.connect(fold.input);
            fold.output.connect(this.#analyser); // Side branch; the analyser has no output
        } else {
            this.#quad = null;
            const panNode = context.createStereoPanner();
            panNode.pan.value = model.pan;
            panNode.connect(this.gainNode).connect(outputNode);
            this.#input = panNode;
            this.#setPan = (value)=>{ panNode.pan.value = value; };
            this.gainNode.connect(this.#analyser); // Side branch; the analyser has no output
        }
        // Keep the audio nodes in step with the model when it's changed from elsewhere (e.g. a server update).
        const stopSync = $effect.root(()=>{
            $effect(()=>{ this.gainNode.gain.value = this.#muted ? 0 : model.gain; });
            $effect(()=>{ this.#setPan(model.pan); });
        });
        this.#disconnect = ()=>{
            console.debug("Disconnecting AudioTrack from destination");
            stopSync();
            this.gainNode.disconnect();
        }
    }

    get input(): AudioNode { return this.#input; }
    get analyser(): AnalyserNode { return this.#analyser; }
    /** The four-channel panner, for a track made with `quad`; null for a stereo one. */
    protected get quad(): QuadPanner|null { return this.#quad; }

    get gain() { return this.#model.gain; }
    get pan() {return this.#model.pan; }
    
    set gain(val: number) { 
        this.#model.gain = val; 
        this.gainNode.gain.value = this.#muted ? 0 : this.#model.gain;
    }
    get muted(): boolean { return this.#muted; }
    set muted(value: boolean) {
        this.#muted = value;
        this.gainNode.gain.value = value ? 0 : this.#model.gain;
        if(this.#muteStorageKey !== null){
            try {
                if(value) localStorage.setItem(this.#muteStorageKey, '1');
                else localStorage.removeItem(this.#muteStorageKey);
            } catch { /* storage unavailable; mute just won't persist */ }
        }
    }

    /**
     * Remember this track's mute state on this device under the given key, and restore it now - or, with
     * `restore` false, keep the current state and save it under the new key instead (for a track whose key moved).
     */
    persistMute(key: string, restore = true) {
        this.#muteStorageKey = `mixer.mute.${key}`;
        if(!restore){
            this.muted = this.#muted;
            return;
        }
        try {
            this.muted = localStorage.getItem(this.#muteStorageKey) === '1';
        } catch { /* storage unavailable */ }
    }
    set pan(val: number) {
        this.#model.pan = Math.min(1, Math.max(-1, val)); 
        this.#setPan(this.#model.pan);
    }

    getGainDB(): number {
        return 10 * Math.log10(this.gain);
    }

    setGainDB(gainDB: number): void {
        this.gain = Math.pow(10, gainDB/10);
    }

    close(): void {
        this.#disconnect();
    }
}