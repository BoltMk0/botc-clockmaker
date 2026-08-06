import type { AudioTrackModel } from "../common/model/audioTrackModel.svelte";

export interface AudioTrackBase {
    get input(): AudioNode;
    
    gain: number;
    pan: number;
    
    close(): void;
}

export class AudioTrack implements AudioTrackBase {
    private gainNode: GainNode;
    private panNode: StereoPannerNode;
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
        this.#disconnect = ()=>{
            console.debug("Disconnecting AudioTrack from destination");
            this.gainNode.disconnect();
        }
    }

    get input(): AudioNode { return this.panNode; }

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