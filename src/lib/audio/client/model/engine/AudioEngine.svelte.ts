import type { ClockClientModel } from "$lib/model/client/ClockClientModel";
import type { AudioTrackModelBase } from "./AudioTrackModelBase";
import { ClockAudioTrackModel, type ClockAudioTrackOptions } from "$lib/audio/client/model/engine/ClockAudioTrack.svelte";
import { ResourceAudioTrackModel } from "$lib/audio/client/model/engine/ResourceAudioTrackModel.svelte";

export class ClocktowerAudioEngine implements AudioTrackModelBase {
    private readonly masterGain: GainNode;
    private readonly masterPanner: StereoPannerNode;
    private cleanupEffects: ()=>void;

    private audioTracks: AudioTrackModelBase[] = [];
    private clockTracks: Map<ClockClientModel, ClockAudioTrackModel> = new Map();

    gain: number = $state(1);
    pan: number = $state(0);

    constructor(readonly audioContext: AudioContext, public clockCreationOptions: ClockAudioTrackOptions = {}){
        this.masterGain = this.audioContext.createGain();
        this.masterPanner = this.audioContext.createStereoPanner();

        this.masterGain.gain.value = 1.0;
        this.masterPanner.pan.value = 0.0;

        this.masterGain.connect(this.masterPanner).connect(this.audioContext.destination);
        
        this.cleanupEffects = $effect.root(()=>{
            $effect(()=>{
                this.masterGain.gain.value = this.gain;
            });

            $effect(()=>{
                this.masterPanner.pan.value = this.pan;
            });
        })
    }

    get input(){ return this.masterGain; }

    getClockTrackModelFor(clockClientModel: ClockClientModel): ClockAudioTrackModel {
        if(this.clockTracks.has(clockClientModel)){
            return this.clockTracks.get(clockClientModel)!;
        }
        const track = new ClockAudioTrackModel(this.audioContext, clockClientModel, this.input, this.clockCreationOptions);
        this.clockTracks.set(clockClientModel, track);
        this.audioTracks.push(track);
        return track;
    }

    createResourceAudioTrackModel(){
        const t = new ResourceAudioTrackModel(this.audioContext, this.masterGain);
        this.audioTracks.push(t);
        return t;
    }

    forEachClockTrackModel(callback: (track: ClockAudioTrackModel, model: ClockClientModel) => void){
        this.clockTracks.forEach((track, model)=>{
            callback(track, model);
        });
    }

    allClockTrackModels(): {track: ClockAudioTrackModel, model: ClockClientModel}[]{
        const result: {track: ClockAudioTrackModel, model: ClockClientModel}[] = [];
        this.clockTracks.forEach((track, model)=>{
            result.push({track, model});
        });
        return result;
    }
        

    close(){
        for(const track of this.audioTracks){
            track.close();
        }
        this.clockTracks.clear();
        this.audioTracks = [];

        this.masterGain.disconnect();
        this.masterPanner.disconnect();
        this.audioContext.close();
        this.cleanupEffects();
    }

    getGainDB(): number {
        return 20 * Math.log10(this.gain);
    }

    setGainDB(gainDB: number): void {
        this.gain = Math.pow(10, gainDB / 20);
    }
}