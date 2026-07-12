import type { ClockClientModel } from "$lib/model/client/ClockClientModel";
import type { AudioTrackModelBase } from "./AudioTrackModelBase";
import { ClockAudioTrackModel, type ClockAudioTrackOptions } from "$lib/audio/client/model/ClockAudioTrack.svelte";
import { ResourceAudioTrackModel } from "$lib/audio/client/model/ResourceAudioTrackModel.svelte";
import { v7 } from "uuid";
import { browser } from "$app/environment";
import { AudioTrackGroupModel } from "./AudioTrackGroupModel.svelte";
import type { Resource } from "$lib/resources/common/types";

const MAX_AMBIENCE_TRACKS = 4;

class AmbienceEngine extends AudioTrackGroupModel {
    private _playing = $state(false);
    get playing() { return this._playing; }

    togglePlayPause(){
        if(this._playing) this.stop();
        else this.play();
    }

    play(){
        for(const t of this.audioTracks){
            console.debug(`AmbienceEngine - Playing track ${t.id} at random position`);
            (t as ResourceAudioTrackModel).playFromRandomPosition();
        }
        this._playing = true;
    }

    stop(){
        for(const t of this.audioTracks){
            (t as ResourceAudioTrackModel).pause();
        }
        this._playing = false;
    }
}

type ClocktowerAudioEngineOpts = {
    muted?: boolean;
}

export class ClocktowerAudioEngine implements AudioTrackModelBase {
    private readonly masterGain: GainNode;
    private readonly masterMute: GainNode;
    private readonly masterPanner: StereoPannerNode;
    private cleanupEffects: ()=>void;
    private saveStateTimeout: ReturnType<typeof setTimeout>|null = null;

    readonly clockTracks: AudioTrackGroupModel;
    readonly ambienceTracks: AmbienceEngine|null;

    readonly id: string;

    gain: number = $state(1);
    pan: number = $state(0);
    muted: boolean;
    readonly title: string = "Audio Engine";
    

    constructor(readonly audioContext: AudioContext, clockModels: ClockClientModel[], readonly ambienceResources: Resource[], public clockCreationOptions: ClockAudioTrackOptions = {}, opts: ClocktowerAudioEngineOpts = {}){
        // If the user hasn't interacted with the page, no audio will play
        // Using a "Mute" functionality to force an interaction.
        this.muted = $state(opts.muted === undefined ? audioContext.state === 'suspended' : opts.muted);

        this.masterGain = this.audioContext.createGain();
        this.masterMute = this.audioContext.createGain();
        this.masterPanner = this.audioContext.createStereoPanner();

        this.masterGain.gain.value = 1.0;
        this.masterPanner.pan.value = 0.0;

        this.masterGain.connect(this.masterPanner).connect(this.masterMute).connect(this.audioContext.destination);
        
        this.cleanupEffects = $effect.root(()=>{
            $effect(()=>{
                this.masterGain.gain.value = this.gain;
                this.saveState();
            });

            $effect(()=>{
                this.masterPanner.pan.value = this.pan;
                this.saveState();
            });

            $effect(()=>{
                if(this.muted){
                    this.masterMute.gain.value = 0;
                } else {
                    this.masterMute.gain.value = 1;
                }
            });
        });

        this.clockTracks = new AudioTrackGroupModel("Clocks", this.audioContext, this.input);
        for(const model of clockModels){
            const t = new ClockAudioTrackModel(this.audioContext, model, this.clockTracks.input, clockCreationOptions);
            this.clockTracks.addAudioTrackModel(t);
        }

        if(ambienceResources.length > 0){
            this.ambienceTracks = new AmbienceEngine("Ambience Engine", this.audioContext, this.input);
            for(let i=0; i<Math.min(ambienceResources.length, MAX_AMBIENCE_TRACKS); i++){
                const t = new ResourceAudioTrackModel(this.audioContext, this.ambienceTracks.input);
                t.title = ambienceResources[i].name;
                t.loadResource(ambienceResources[i]);
                t.loop = true;
                this.ambienceTracks.addAudioTrackModel(t);
            }
        } else {
            this.ambienceTracks = null;
        }

        this.id = this.title.toLowerCase().replaceAll(' ', '_');

        this.loadState();
    }

    get input(){ return this.masterGain; }

    getClockTrackModelWithId(id: string){
        return this.clockTracks.getTrack(id);
    }

    close(){
        this.clockTracks.close();
        this.ambienceTracks?.close();
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

    static createNewEngineForClockClients(clients: ClockClientModel[], ambienceResources: Resource[], clockCreationOptions: ClockAudioTrackOptions = {}, opts: ClocktowerAudioEngineOpts = {}){
        if(!browser){
            throw new Error("AudioEngine instances cannot be created outside of a browser context");
        }

        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioEngine = new ClocktowerAudioEngine(audioContext, clients, ambienceResources, clockCreationOptions, opts);

        const resumeAudioContext = () => {
            audioContext.resume();
        };
        window.addEventListener('pointerdown', resumeAudioContext);

        return {
            audioContext,
            audioEngine,
            teardown: ()=>{
                window.removeEventListener('pointerdown', resumeAudioContext);
                audioEngine.close();
            }
        }
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