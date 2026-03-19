import { writable } from "svelte/store";
import type { AudioTrackBase } from "./AudioTrackBase";

export class AudioTrack implements AudioTrackBase {
    private readonly panNode: StereoPannerNode;
    private readonly gainNode: GainNode;
    private readonly audioSource: MediaElementAudioSourceNode;
    
    private unsubscribes: (()=>void)[] = [];

    gain = writable(0);
    pan = writable(0);

    constructor(
        private readonly audioContext: AudioContext, 
        readonly audio: HTMLAudioElement,
        outputNode: AudioNode = audioContext.destination
    ){
        this.panNode = audioContext.createStereoPanner();
        this.gainNode = audioContext.createGain();
        this.audioSource = audioContext.createMediaElementSource(audio);

        this.gainNode.gain.value = 1.0;
        this.panNode.pan.value = 0.0;

        this.audioSource.connect(this.gainNode).connect(this.panNode).connect(outputNode);

        this.unsubscribes.push(this.gain.subscribe(value => {
            this.gainNode.gain.value = value;
        }));

        this.unsubscribes.push(this.pan.subscribe(value => {
            this.panNode.pan.value = value;
        }));
    }

    setGainWithInterpolation(gain: number, interpolation_s: number = 0.1){
        this.gainNode.gain.setTargetAtTime(gain, this.audioContext.currentTime, this.audioContext.currentTime + interpolation_s);
    }

    setGainDB(gainDB: number): void {
        const gain = Math.pow(10, gainDB / 20);
        this.gain.set(gain);
    }

    getGainDB(): number {
        const gain = this.gainNode.gain.value;
        return 20 * Math.log10(gain);
    }

    close(){
        this.unsubscribes.forEach(unsub => unsub());
        this.unsubscribes = [];
        this.audioSource.disconnect();
        this.gainNode.disconnect();
        this.panNode.disconnect();
        this.audio.pause();
        this.audio.src = "";
    }
}