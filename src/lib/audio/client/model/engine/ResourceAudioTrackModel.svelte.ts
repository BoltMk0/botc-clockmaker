import type { AudioTrackModelBase } from "./AudioTrackModelBase";
import type { Resource } from "$lib/resources/common/types";

export class ResourceAudioTrackModel implements AudioTrackModelBase {
    private readonly panNode: StereoPannerNode;
    private readonly gainNode: GainNode;
    private readonly audio: HTMLAudioElement;
    private readonly audioSource: MediaElementAudioSourceNode;
    
    private cleanupEffects: ()=>void;

    gain = $state(0);
    pan = $state(0);

    constructor(
        private readonly audioContext: AudioContext, 
        outputNode: AudioNode = audioContext.destination
    ){
        this.panNode = audioContext.createStereoPanner();
        this.gainNode = audioContext.createGain();
        this.audio = new Audio();
        this.audioSource = audioContext.createMediaElementSource(this.audio);

        this.gainNode.gain.value = 1.0;
        this.panNode.pan.value = 0.0;

        this.audioSource.connect(this.gainNode).connect(this.panNode).connect(outputNode);

        this.cleanupEffects = $effect.root(()=>{
            $effect(()=>{
                this.gainNode.gain.value = this.gain;
            });

            $effect(()=>{
                this.panNode.pan.value = this.pan;
            })
        });
    }

    get input(){return this.gainNode; }

    loadResource(resource: Resource|string|null){
        if(!resource){
            this.audio.pause();
            this.audio.src = "";
            return;
        }
        this.audio.src = typeof resource ==='string' ? resource : `/api/resources/${resource.id}`;
        this.audio.load();
    }

    play(){
        return this.audio.play();
    }

    pause(){
        this.audio.pause();
    }

    seek(position: number){
        this.currentTime = position
    }

    get currentTime(): number { return this.audio.currentTime; }
    set currentTime(newValue: number) { this.audio.currentTime = newValue; }

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
        this.audioSource.disconnect();
        this.gainNode.disconnect();
        this.panNode.disconnect();
        this.audio.pause();
        this.audio.src = "";
    }
}