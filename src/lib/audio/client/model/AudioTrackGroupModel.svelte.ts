import { v7 } from "uuid";
import type { AudioTrackModelBase } from "./AudioTrackModelBase";

export class AudioTrackGroupModel implements AudioTrackModelBase {

    private readonly panNode: StereoPannerNode;
    private readonly gainNode: GainNode;
    
    private cleanupEffects: ()=>void;

    readonly id = v7();

    title = $state("");
    gain = $state(0);
    pan = $state(0);

    constructor(
        private readonly audioContext: AudioContext, 
        outputNode: AudioNode = audioContext.destination
    ){
        this.panNode = audioContext.createStereoPanner();
        this.gainNode = audioContext.createGain();

        this.gainNode.gain.value = 1.0;
        this.panNode.pan.value = 0.0;

        this.cleanupEffects = $effect.root(()=>{
            $effect(()=>{
                this.gainNode.gain.value = this.gain;
            });

            $effect(()=>{
                this.panNode.pan.value = this.pan;
            })
        });

        this.gainNode.connect(this.panNode).connect(outputNode);
    }

    get input(){return this.gainNode; }

    setGainWithInterpolation(gain: number, interpolation_s: number = 0.1){
        this.gainNode.gain.setTargetAtTime(gain, this.audioContext.currentTime, this.audioContext.currentTime + interpolation_s);
    }

    setGainDB(gainDB: number): void {
        const gain = Math.pow(10, gainDB / 20);
        this.gain = gain
    }

    getGainDB(): number {
        const gain = this.gainNode.gain.value;
        return 20 * Math.log10(gain);
    }

    close(){
        this.cleanupEffects();
        this.gainNode.disconnect();
        this.panNode.disconnect();
    }
}