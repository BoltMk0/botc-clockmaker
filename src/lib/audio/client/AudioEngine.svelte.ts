import { untrack } from "svelte";
import type { Clocktower } from "$lib/model/client/Clocktower.svelte";
import { combineTimesOfDay, type TimeOfDay } from "$lib/model/client/types";
import { TimeOfDayTrim } from "./TimeOfDayTrim.svelte";
import type { TimeOfDayTrimModel } from "../common/model/timeOfDayTrimModel";
import { AmbienceEngine } from "../../audio/client/AmbienceEngine.svelte";
import type { AmbienceEngineModel } from "../common/model/ambienceEngineModel";
import type { AudioTrackModel } from "../common/model/audioTrackModel.svelte";
import { AudioClockTrack } from "./AudioClockTrack.svelte";
import { AudioTrack, type AudioTrackBase } from "./AudioTrack.svelte";
import { AudioDim } from "./AudioDim.svelte";
import { StingEngine } from "./StingEngine.svelte";
import type { StingEngineModel } from "../common/model/stingEngineModel";

/** Time constant of the dim ramp: settles in roughly half a second, without clicks. */
const DIM_TIME_CONSTANT_S = 0.12;

const MUTE_STORAGE_KEY = 'mixer.mute.master';

/** How long the level takes to fade into the new phase's trim when the phase changes - in step with the ambience tracks' own fades. */
const TIME_OF_DAY_TRIM_PHASE_FADE_S = 3;
/** Time constant of the ramp while a trim knob is being turned: quick, just enough to avoid zipper noise. */
const TIME_OF_DAY_TRIM_KNOB_TIME_CONSTANT_S = 0.03;
/** Step interval of Spotify's phase-change fade: each step is a volume call to Spotify, so keep well inside its rate limits. */
const SPOTIFY_TRIM_FADE_STEP_MS = 250;

export class AudioEngine implements AudioTrackBase {
    #context: AudioContext;

    #model: AudioTrackModel = $state({gain: 1.0, pan: 0.0})
    #gainNode: GainNode;
    // Per-phase trim on top of the master fader. Unlike the fader, shared across every client (like the dim).
    #timeOfDayTrim = new TimeOfDayTrim();
    #timeOfDayNode: GainNode;
    // Spotify can't go through #timeOfDayNode (see ChannelStripSpotify), so it gets its own copy of the trim,
    // stepped through the same fade on a phase change
    #spotifyTrimDb = $state(0);
    #spotifyFadeTimer: ReturnType<typeof setInterval>|null = null;
    #stopTrimEffects: ()=>void;
    #dimNode: GainNode; // After the master fader, so dimming never fights the user's gain
    #dim: AudioDim|null = null;
    #stopEffects: (()=>void)|null = null;
    #muted = $state(false);
    #analyser: AnalyserNode;

    // Clocks (player bells) and the sting engine get their own independent master bus - a separate mixer
    // in the UI, with its own fader - rather than sharing the main one with ambience/Spotify. It feeds
    // #sfxOutputNode straight to the destination instead of #dimNode, so the shared "dim" (grim dim
    // button) only ever affects Music & Ambience, never SFX.
    #clocksMasterModel: AudioTrackModel = $state({gain: 1.0, pan: 0.0})
    #clocksMasterBus: AudioTrack;
    #sfxOutputNode: GainNode;

    #clockAudioTracks: AudioClockTrack[];
    #ambienceEngineModel: AmbienceEngineModel|null;
    #ambienceEngine: AmbienceEngine|null;
    #stingEngineModel: StingEngineModel|null;
    #stingEngine: StingEngine|null;
    #timeOfDay: TimeOfDay;
    readonly #silent: boolean;

    /**
     * @param options.silent Nothing ever plays on this client: the output isn't connected, ambience never starts and
     *   bells never ring. The mixer controls still work, editing the shared state for other clients.
     */
    constructor(clocks: Clocktower[], ambienceEngineModel?: AmbienceEngineModel, stingEngineModel?: StingEngineModel, options: {silent?: boolean} = {}){
        this.#silent = options.silent ?? false;
        this.#context = new AudioContext();
        this.#gainNode = this.#context.createGain();
        this.#gainNode.gain.value = 1;
        this.#timeOfDayNode = this.#context.createGain();
        this.#dimNode = this.#context.createGain();
        this.#gainNode.connect(this.#timeOfDayNode).connect(this.#dimNode);
        this.#sfxOutputNode = this.#context.createGain();
        if(!this.#silent){
            this.#dimNode.connect(this.#context.destination);
            this.#sfxOutputNode.connect(this.#context.destination);
        }
        this.#analyser = this.#context.createAnalyser();
        this.#timeOfDayNode.connect(this.#analyser);
        this.#clocksMasterBus = new AudioTrack(this.#clocksMasterModel, this.#sfxOutputNode, 'Clocks & Sting Master');
        console.log("Connection", clocks.length, "clocks")
        this.#clockAudioTracks = clocks.map(c=>c.connectAudio(this.#clocksMasterBus.input));
        if(this.#silent) this.#clockAudioTracks.forEach(t=>t.silent = true);
        // With several games each in their own phase, the earliest wins: it's day if any game is in daytime.
        this.#timeOfDay = $derived(combineTimesOfDay(clocks.map(clock=>clock.timeOfDay)));
        this.#timeOfDayNode.gain.value = this.timeOfDayGain;
        this.#spotifyTrimDb = this.#timeOfDayTrim.model[this.#timeOfDay];
        // Runs even on a silent client, which can still be the one driving Spotify's volume
        let lastSpotifyTimeOfDay = this.#timeOfDay;
        this.#stopTrimEffects = $effect.root(()=>{
            $effect(()=>{
                const timeOfDay = this.#timeOfDay;
                const targetDb = this.#timeOfDayTrim.model[timeOfDay];
                const phaseChanged = timeOfDay !== lastSpotifyTimeOfDay;
                lastSpotifyTimeOfDay = timeOfDay;
                this.stopSpotifyFade();
                if(!phaseChanged){
                    this.#spotifyTrimDb = targetDb;
                    return;
                }
                // Linear in dB, matching the Web Audio fade
                const startDb = untrack(()=>this.#spotifyTrimDb);
                const start = Date.now();
                this.#spotifyFadeTimer = setInterval(()=>{
                    const t = Math.min(1, (Date.now() - start) / (TIME_OF_DAY_TRIM_PHASE_FADE_S * 1000));
                    this.#spotifyTrimDb = startDb + (targetDb - startDb) * t;
                    if(t >= 1) this.stopSpotifyFade();
                }, SPOTIFY_TRIM_FADE_STEP_MS);
            });
        });
        this.#ambienceEngineModel = $state(ambienceEngineModel ?? null)
        this.#ambienceEngine = this.#ambienceEngineModel ? new AmbienceEngine(this.#ambienceEngineModel, this.#gainNode, ()=>this.#timeOfDay, {silent: this.#silent}) : null;
        this.#stingEngineModel = $state(stingEngineModel ?? null)
        this.#stingEngine = this.#stingEngineModel ? new StingEngine(this.#stingEngineModel, this.#clocksMasterBus.input, {silent: this.#silent}) : null;
        try {
            this.muted = localStorage.getItem(MUTE_STORAGE_KEY) === '1';
        } catch { /* storage unavailable */ }
        this.#clocksMasterBus.persistMute('master.clocks');
        if(!this.#silent){
            // Follow the shared dim (a silent client plays nothing, so has nothing to dim)
            const dim = this.#dim = new AudioDim();
            let lastTimeOfDay = this.#timeOfDay;
            this.#stopEffects = $effect.root(()=>{
                $effect(()=>{
                    this.#dimNode.gain.setTargetAtTime(dim.gain, this.#context.currentTime, DIM_TIME_CONSTANT_S);
                });
                $effect(()=>{
                    // Fade into a new phase's trim, but follow a knob being turned straight away
                    const timeOfDay = this.#timeOfDay;
                    const gain = this.timeOfDayGain;
                    const phaseChanged = timeOfDay !== lastTimeOfDay;
                    lastTimeOfDay = timeOfDay;
                    const param = this.#timeOfDayNode.gain;
                    const now = this.#context.currentTime;
                    const current = param.value; // Reflects any fade in progress
                    param.cancelScheduledValues(now);
                    param.setValueAtTime(current, now);
                    if(phaseChanged){
                        // Exponential in gain is linear in dB, so the fade sounds even all the way through - unlike
                        // setTargetAtTime, which does most of its change in the first moment and so sounds abrupt.
                        // (Never ramps to/from 0: the trims only go down to -12dB.)
                        param.exponentialRampToValueAtTime(gain, now + TIME_OF_DAY_TRIM_PHASE_FADE_S);
                    } else {
                        param.setTargetAtTime(gain, now, TIME_OF_DAY_TRIM_KNOB_TIME_CONSTANT_S);
                    }
                });
            });
            this.#context.resume();
        }
    }

    resume(){
        if(this.#silent) return;
        this.#context.resume();
        // Media element playback may have been blocked by the autoplay policy until this gesture.
        this.#ambienceEngine?.retryPlayback();
    }

    get clockAudioTracks(){ return this.#clockAudioTracks; }
    get ambienceEngine(){ return this.#ambienceEngine; }
    get stingEngine(){ return this.#stingEngine; }
    get timeOfDay(){ return this.#timeOfDay; }
    /** Independent master bus for the clocks/sting mixer - its own fader, separate from this engine's own (ambience/Spotify). */
    get clocksMaster(): AudioTrackBase { return this.#clocksMasterBus; }

    get muted(){ return this.#muted; }
    set muted(value: boolean){
        this.#muted = value;
        this.#gainNode.gain.value = value ? 0 : this.#model.gain;
        try {
            if(value) localStorage.setItem(MUTE_STORAGE_KEY, '1');
            else localStorage.removeItem(MUTE_STORAGE_KEY);
        } catch { /* storage unavailable; mute just won't persist */ }
    }

    get gain(){ return this.#model.gain; }
    set gain(value: number){
        this.#model.gain = Math.max(0, value);
        this.#gainNode.gain.value = this.#muted ? 0 : this.#model.gain;
    }

    /** Shared per-phase trim (dB) applied on top of the master fader. */
    get timeOfDayTrimDb(): Readonly<TimeOfDayTrimModel> { return this.#timeOfDayTrim.model; }
    setTimeOfDayTrimDb(timeOfDay: TimeOfDay, db: number){ this.#timeOfDayTrim.set(timeOfDay, db); }
    /** Linear gain of the current phase's trim. */
    get timeOfDayGain(){ return this.#timeOfDayTrim.gain(this.#timeOfDay); }
    /** Linear gain of the trim for Spotify: as timeOfDayGain, but stepped through the fade when the phase changes. */
    get spotifyTimeOfDayGain(){ return Math.pow(10, this.#spotifyTrimDb / 20); }

    private stopSpotifyFade(){
        if(this.#spotifyFadeTimer === null) return;
        clearInterval(this.#spotifyFadeTimer);
        this.#spotifyFadeTimer = null;
    }

    get input(){ return this.#gainNode; }
    get analyser(){ return this.#analyser; }

    get pan(){ return 0; }
    set pan(value: number){ return; }

    close(): void {
        for(const clock of this.#clockAudioTracks){
            clock.close();
        }
        this.#stopEffects?.();
        this.#stopTrimEffects();
        this.stopSpotifyFade();
        this.#dim?.close();
        this.#timeOfDayTrim.close();
        this.#ambienceEngine?.close();
        this.#stingEngine?.close();
        this.#clocksMasterBus.close();
        this.#context.close();
    }
}
