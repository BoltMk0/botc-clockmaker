import { v7 } from "uuid";
import type { AudioTrackModelBase } from "./AudioTrackModelBase";
import { ResourceAudioTrackModel } from "./ResourceAudioTrackModel.svelte";

export class AudioTrackGroupModel implements AudioTrackModelBase {

    private readonly panNode: StereoPannerNode;
    private readonly gainNode: GainNode;
    private cleanupEffects: ()=>void;
    private saveStateTimeout: ReturnType<typeof setTimeout>|null = null;

    readonly id: string;

    gain = $state(1);
    pan = $state(0);

    private _audioTracks: AudioTrackModelBase[] = $state([]);
    get audioTracks() { return this._audioTracks; }

    constructor(
        readonly title: string,
        private readonly audioContext: AudioContext, 
        outputNode: AudioNode = audioContext.destination
    ){
        this.id = title.toLowerCase().replaceAll(' ', '_');
        this.panNode = audioContext.createStereoPanner();
        this.gainNode = audioContext.createGain();

        this.gainNode.gain.value = 1.0;
        this.panNode.pan.value = 0.0;

        this.cleanupEffects = $effect.root(()=>{
            $effect(()=>{
                this.gainNode.gain.value = this.gain;
                this.saveState();
            });

            $effect(()=>{
                this.panNode.pan.value = this.pan;
                this.saveState();
            })
        });

        this.gainNode.connect(this.panNode).connect(outputNode);

        this.loadState();
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
        for(const t of this._audioTracks){
            t.close();
        }
        this.gainNode.disconnect();
        this.panNode.disconnect();
        this.cleanupEffects();
    }

    createResourceAudioTrackModel(){
        const t = new ResourceAudioTrackModel(this.audioContext, this.input);
        this.addAudioTrackModel(t);
        return t;
    }

    addAudioTrackModel(t: AudioTrackModelBase){
        if(!this._audioTracks.find(track => track.id === t.id))
            this._audioTracks.push(t);
    }

    getTrack(id: string){
        return this._audioTracks.find(t=>t.id === id);
    }

    
    private saveState(){
        if(this.saveStateTimeout) clearTimeout(this.saveStateTimeout);
        this.saveStateTimeout = setTimeout(()=>{
            console.log(`Saved audio state of ${this.title}`)
            localStorage.setItem(`${this.id}_audio_state`, JSON.stringify({gain: this.gain, pan: this.pan}));
            this.saveStateTimeout = null;
        }, 500);
    }

    private loadState(){
        const storedValue = localStorage.getItem(`${this.id}_audio_state`);
        if(storedValue){
            const parsedValue = JSON.parse(storedValue);
            this.gain = parsedValue.gain ?? this.gain;
            this.pan = parsedValue.pan ?? this.pan;
        }
    }
}