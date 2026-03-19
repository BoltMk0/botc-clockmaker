import { get, writable } from "svelte/store";
import type { ClockClientModel } from "../model";
import type { AudioTrackBase } from "./AudioTrackBase";
import { ClockAudioTrack, type ClockAudioTrackOptions } from "./ClockAudioTrack";

export class ClocktowerAudioEngine implements AudioTrackBase {
    private readonly masterGain: GainNode;
    private readonly masterPanner: StereoPannerNode;

    private clockTracks: Map<ClockClientModel, ClockAudioTrack> = new Map();

    gain = writable(1);
    pan = writable(0);

    constructor(readonly audioContext: AudioContext, public clockCreationOptions: ClockAudioTrackOptions = {}){
        this.masterGain = this.audioContext.createGain();
        this.masterPanner = this.audioContext.createStereoPanner();

        this.masterGain.gain.value = 1.0;
        this.masterPanner.pan.value = 0.0;

        this.masterGain.connect(this.masterPanner).connect(this.audioContext.destination);

        this.gain.subscribe(value => {
            this.masterGain.gain.value = value;
        });

        this.pan.subscribe(value => {
            this.masterPanner.pan.value = value;
        });
    }

    getClockTrackFor(clockClientModel: ClockClientModel): ClockAudioTrack {
        if(this.clockTracks.has(clockClientModel)){
            return this.clockTracks.get(clockClientModel)!;
        }
        const track = new ClockAudioTrack(this.audioContext, clockClientModel, this.masterGain, this.clockCreationOptions);
        this.clockTracks.set(clockClientModel, track);
        return track;
    }



    forEachClockTrack(callback: (track: ClockAudioTrack, model: ClockClientModel) => void){
        this.clockTracks.forEach((track, model)=>{
            callback(track, model);
        });
    }

    allClockTracks(): {track: ClockAudioTrack, model: ClockClientModel}[]{
        const result: {track: ClockAudioTrack, model: ClockClientModel}[] = [];
        this.clockTracks.forEach((track, model)=>{
            result.push({track, model});
        });
        return result;
    }
        

    close(){
        for(const track of this.clockTracks.values()){
            track.close();
        }
        this.clockTracks.clear();

        this.masterGain.disconnect();
        this.masterPanner.disconnect();
        this.audioContext.close();
    }

    getGainDB(): number {
        return 20 * Math.log10(get(this.gain));
    }

    setGainDB(gainDB: number): void {
        this.gain.set(Math.pow(10, gainDB / 20));
    }
}