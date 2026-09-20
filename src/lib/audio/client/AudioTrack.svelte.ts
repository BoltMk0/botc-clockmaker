import type { AudioTrackModel } from "../common/model/audioTrackModel.svelte";

export interface AudioTrackBase {
    get input(): AudioNode;
    /** Post-fader tap for level metering. */
    get analyser(): AnalyserNode;

    gain: number;
    pan: number;
    
    close(): void;
}

export class AudioTrack implements AudioTrackBase {
    private gainNode: GainNode;
    private panNode: StereoPannerNode;
    readonly #analyser: AnalyserNode;
    readonly #disconnect: ()=>void;
    readonly #model: AudioTrackModel;

    constructor(
        model: AudioTrackModel,
        outputNode:     AudioNode, 
        readonly title: string
    ) {
        const context = outputNode.context;
        
        this.#model = model
        this.gainNode = context.createGain();
        this.gainNode.gain.value = model.gain;
        this.panNode = context.createStereoPanner();
        this.panNode.pan.value = model.pan;
        this.panNode.connect(this.gainNode).connect(outputNode);
        this.#analyser = context.createAnalyser();
        this.gainNode.connect(this.#analyser); // Side branch; the analyser has no output
        // Keep the audio nodes in step with the model when it's changed from elsewhere (e.g. a server update).
        const stopSync = $effect.root(()=>{
            $effect(()=>{ this.gainNode.gain.value = model.gain; });
            $effect(()=>{ this.panNode.pan.value = model.pan; });
        });
        this.#disconnect = ()=>{
            console.debug("Disconnecting AudioTrack from destination");
            stopSync();
            this.gainNode.disconnect();
        }
    }

    get input(): AudioNode { return this.panNode; }
    get analyser(): AnalyserNode { return this.#analyser; }

    get gain() { return this.#model.gain; }
    get pan() {return this.#model.pan; }
    
    set gain(val: number) { 
        this.#model.gain = val; 
        this.gainNode.gain.value = this.#model.gain;
    }
    set pan(val: number) {
        this.#model.pan = Math.min(1, Math.max(-1, val)); 
        this.panNode.pan.value = this.#model.pan;
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