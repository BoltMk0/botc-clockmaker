import type { Clocktower } from "$lib/model/client/Clocktower.svelte";
import { combineTimesOfDay, type TimeOfDay } from "$lib/model/client/types";
import { TimeOfDayTrim } from "./TimeOfDayTrim.svelte";
import { MixerMasters } from "./MixerMasters.svelte";
import type { TimeOfDayTrimModel } from "../common/model/timeOfDayTrimModel";
import { AmbienceEngine } from "../../audio/client/AmbienceEngine.svelte";
import type { AmbienceEngineModel } from "../common/model/ambienceEngineModel";
import type { AudioTrackModel } from "../common/model/audioTrackModel.svelte";
import { AudioClockTrack } from "./AudioClockTrack.svelte";
import { AudioTrack, type AudioTrackBase } from "./AudioTrack.svelte";
import { AudioDim } from "./AudioDim.svelte";
import { DIM_FADE_MS } from "../common/model/audioDimModel";
import { StingEngine } from "./StingEngine.svelte";
import type { StingEngineModel } from "../common/model/stingEngineModel";
import { createMeterFold } from "./QuadPanner";

/** Time constant of the ramp while the dim amount is being changed: quick, just enough to avoid zipper noise. */
const DIM_AMOUNT_TIME_CONSTANT_S = 0.03;

const MUTE_STORAGE_KEY = 'mixer.mute.master';
const SPEAKER_LAYOUT_STORAGE_KEY = 'audio.speakerLayout';

/** The speakers this device plays to: a stereo pair, or 4.0 - front left, front right, rear left, rear right. */
export type SpeakerLayout = 'stereo'|'quad';

/** How long the speaker test sounds each speaker for, and the gap between them. */
const SPEAKER_TEST_TONE_S = 1;
const SPEAKER_TEST_GAP_S = 0.25;
/** Level of the speaker test's pink noise (about -12dB at its peaks): clearly heard, without startling anyone. */
const SPEAKER_TEST_GAIN = 0.25;
const SPEAKER_TEST_RAMP_S = 0.02;

/** How long the level takes to fade into the new phase's trim when the phase changes - in step with the ambience tracks' own fades. */
const TIME_OF_DAY_TRIM_PHASE_FADE_S = 3;
/** Time constant of the ramp while a trim knob is being turned: quick, just enough to avoid zipper noise. */
const TIME_OF_DAY_TRIM_KNOB_TIME_CONSTANT_S = 0.03;

export class AudioEngine implements AudioTrackBase {
    #context: AudioContext;

    // Both master faders (this one and the clocks/sting one) are shared across every client; only the mutes are local.
    #masters = new MixerMasters();
    #gainNode: GainNode;
    // Per-phase trim on top of the master fader, also shared (like the dim).
    #timeOfDayTrim = new TimeOfDayTrim();
    #timeOfDayNode: GainNode;
    // (Spotify can't go through #timeOfDayNode; the server applies the trim to its volume instead - see SpotifyHelper.)
    #dimNode: GainNode; // After the master fader, so dimming never fights the user's gain
    #dim: AudioDim|null = null;
    #stopEffects: (()=>void)|null = null;
    #stopMasterSync: ()=>void;
    #muted = $state(false);
    #analyser: AnalyserNode;

    // Clocks (player bells) and the sting engine get their own independent master bus - a separate mixer
    // in the UI, with its own fader - rather than sharing the main one with ambience/Spotify. It feeds
    // #sfxOutputNode straight to the destination instead of #dimNode, so the shared "dim" (grim dim
    // button) only ever affects Music & Ambience, never SFX.
    #clocksMasterBus: AudioTrack;
    #sfxOutputNode: GainNode;

    #clockAudioTracks: AudioClockTrack[];
    #ambienceEngineModel: AmbienceEngineModel|null;
    #ambienceEngine: AmbienceEngine|null;
    #stingEngineModel: StingEngineModel|null;
    #stingEngine: StingEngine|null;
    #timeOfDay: TimeOfDay;
    readonly #silent: boolean;
    /** This device's choice of speakers - local to it, like the mutes, since it's about what's plugged into it. */
    #speakerLayout = $state<SpeakerLayout>('stereo');
    /** Channel the speaker test is sounding (0 = front left, 1 = front right, 2 = rear left, 3 = rear right), or null. */
    #speakerTestChannel = $state<number|null>(null);
    #speakerTestStop: (()=>void)|null = null;

    /**
     * @param options.silent Nothing ever plays on this client: the output isn't connected, ambience never starts and
     *   bells never ring, and none of their audio is loaded. The mixer controls still work, editing the shared state for other clients.
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
        // The ambience is four channels (4.0) even on a stereo device, so meter it as two
        const meterFold = createMeterFold(this.#context);
        this.#timeOfDayNode.connect(meterFold.input);
        meterFold.output.connect(this.#analyser);
        try {
            if(localStorage.getItem(SPEAKER_LAYOUT_STORAGE_KEY) === 'quad') this.#speakerLayout = 'quad';
        } catch { /* storage unavailable */ }
        this.applySpeakerLayout();
        // The bus reads and writes its fader through the shared masters (it follows the model's changes itself)
        const masters = this.#masters;
        const clocksMasterModel: AudioTrackModel = {
            get gain(){ return masters.model.clocksGain; },
            set gain(value: number){ masters.set('clocksGain', value); },
            get pan(){ return masters.model.clocksPan; },
            set pan(value: number){ masters.set('clocksPan', value); }
        };
        this.#clocksMasterBus = new AudioTrack(clocksMasterModel, this.#sfxOutputNode, 'Clocks & Sting Master');
        console.log("Connection", clocks.length, "clocks")
        this.#clockAudioTracks = clocks.map(c=>c.connectAudio(this.#clocksMasterBus.input, {silent: this.#silent}));
        // With several games each in their own phase, the earliest wins: it's day if any game is in daytime.
        this.#timeOfDay = $derived(combineTimesOfDay(clocks.map(clock=>clock.timeOfDay)));
        this.#timeOfDayNode.gain.value = this.timeOfDayGain;
        this.#ambienceEngineModel = $state(ambienceEngineModel ?? null)
        this.#ambienceEngine = this.#ambienceEngineModel ? new AmbienceEngine(this.#ambienceEngineModel, this.#gainNode, ()=>this.#timeOfDay, {silent: this.#silent, surround: ()=>this.surround}) : null;
        this.#stingEngineModel = $state(stingEngineModel ?? null)
        this.#stingEngine = this.#stingEngineModel ? new StingEngine(this.#stingEngineModel, this.#clocksMasterBus.input, {silent: this.#silent}) : null;
        try {
            this.muted = localStorage.getItem(MUTE_STORAGE_KEY) === '1';
        } catch { /* storage unavailable */ }
        this.#clocksMasterBus.persistMute('master.clocks');
        // Follow the shared master fader when it's moved from another client
        this.#stopMasterSync = $effect.root(()=>{
            $effect(()=>{ this.#gainNode.gain.value = this.#muted ? 0 : this.#masters.model.mainGain; });
        });
        if(!this.#silent){
            // Follow the shared dim (a silent client plays nothing, so has nothing to dim)
            const dim = this.#dim = new AudioDim();
            let lastTimeOfDay = this.#timeOfDay;
            let lastDimmed = dim.dimmed;
            this.#stopEffects = $effect.root(()=>{
                $effect(()=>{
                    // Fade the dim in or out, but follow the amount being changed straight away
                    const gain = dim.gain;
                    const dimmedChanged = dim.dimmed !== lastDimmed;
                    lastDimmed = dim.dimmed;
                    const param = this.#dimNode.gain;
                    const now = this.#context.currentTime;
                    const current = param.value; // Reflects any fade in progress
                    param.cancelScheduledValues(now);
                    param.setValueAtTime(current, now);
                    if(dimmedChanged){
                        // Linear in dB, like the trim's phase fade (the dim never goes to 0, so this is safe)
                        param.exponentialRampToValueAtTime(gain, now + DIM_FADE_MS / 1000);
                    } else {
                        param.setTargetAtTime(gain, now, DIM_AMOUNT_TIME_CONSTANT_S);
                    }
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

    /** Whether this device plays sound at all (it's false for a remote-only mixer). */
    get playsHere(){ return !this.#silent; }

    /** Most channels this device's audio output can take; 4.0 needs at least four. */
    get maxOutputChannels(){ return this.#context.destination.maxChannelCount; }

    /** This device's chosen speaker layout, even if its output can't currently take it (see `surround`). */
    get speakerLayout(){ return this.#speakerLayout; }
    set speakerLayout(value: SpeakerLayout){
        this.#speakerLayout = value;
        try {
            if(value === 'quad') localStorage.setItem(SPEAKER_LAYOUT_STORAGE_KEY, 'quad');
            else localStorage.removeItem(SPEAKER_LAYOUT_STORAGE_KEY);
        } catch { /* storage unavailable; the layout just won't persist */ }
        this.stopSpeakerTest();
        this.applySpeakerLayout();
    }

    /** Whether this device is playing 4.0: it's set to, and its output has the channels for it. */
    get surround(){ return !this.#silent && this.#speakerLayout === 'quad' && this.maxOutputChannels >= 4; }

    /**
     * Sets the output to two or four channels. The ambience is four channels either way, so they're taken as they are
     * ('discrete'), not mixed as speakers: in stereo that drops the rear pair, rather than folding it into the front at
     * half level, and in 4.0 a stereo signal (music, SFX) goes to the front pair only.
     */
    private applySpeakerLayout(){
        const channels = this.surround ? 4 : 2;
        for(const node of [this.#context.destination, this.#dimNode]){
            node.channelCount = channels;
            node.channelCountMode = 'explicit';
            node.channelInterpretation = 'discrete';
        }
    }

    /** The speaker the speaker test is sounding (0 = front left, 1 = front right, 2 = rear left, 3 = rear right), or null. */
    get speakerTestChannel(){ return this.#speakerTestChannel; }

    /**
     * Plays a burst of pink noise from each speaker in turn (front left, front right, then the rear pair in 4.0), straight
     * to the output - past every fader, mute and the dim - so the wiring can be checked. Stops the test if it's running.
     */
    testSpeakers(){
        if(this.#silent) return;
        if(this.#speakerTestStop !== null){
            this.stopSpeakerTest();
            return;
        }
        this.resume();
        const context = this.#context;
        const channels = this.surround ? 4 : 2;
        const noise = createPinkNoise(context, SPEAKER_TEST_TONE_S);
        const merger = context.createChannelMerger(channels);
        merger.connect(context.destination);
        const start = context.currentTime + 0.05;
        const sources: AudioBufferSourceNode[] = [];
        const timers: ReturnType<typeof setTimeout>[] = [];
        for(let channel = 0; channel < channels; channel++){
            const at = start + channel * (SPEAKER_TEST_TONE_S + SPEAKER_TEST_GAP_S);
            const source = context.createBufferSource();
            source.buffer = noise;
            const envelope = context.createGain();
            envelope.gain.setValueAtTime(0, at);
            envelope.gain.linearRampToValueAtTime(SPEAKER_TEST_GAIN, at + SPEAKER_TEST_RAMP_S);
            envelope.gain.setValueAtTime(SPEAKER_TEST_GAIN, at + SPEAKER_TEST_TONE_S - SPEAKER_TEST_RAMP_S);
            envelope.gain.linearRampToValueAtTime(0, at + SPEAKER_TEST_TONE_S);
            source.connect(envelope).connect(merger, 0, channel);
            source.start(at);
            sources.push(source);
            timers.push(setTimeout(()=>{ this.#speakerTestChannel = channel; }, (at - context.currentTime) * 1000));
        }
        const duration = channels * (SPEAKER_TEST_TONE_S + SPEAKER_TEST_GAP_S);
        timers.push(setTimeout(()=>this.stopSpeakerTest(), (start + duration - context.currentTime) * 1000));
        this.#speakerTestStop = ()=>{
            for(const timer of timers) clearTimeout(timer);
            for(const source of sources){
                try { source.stop(); } catch { /* never started */ }
            }
            merger.disconnect();
        };
    }

    private stopSpeakerTest(){
        this.#speakerTestStop?.();
        this.#speakerTestStop = null;
        this.#speakerTestChannel = null;
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
        this.#gainNode.gain.value = value ? 0 : this.gain;
        try {
            if(value) localStorage.setItem(MUTE_STORAGE_KEY, '1');
            else localStorage.removeItem(MUTE_STORAGE_KEY);
        } catch { /* storage unavailable; mute just won't persist */ }
    }

    get gain(){ return this.#masters.model.mainGain; }
    set gain(value: number){
        this.#masters.set('mainGain', value);
        this.#gainNode.gain.value = this.#muted ? 0 : this.gain;
    }

    /** Shared per-phase trim (dB) applied on top of the master fader. */
    get timeOfDayTrimDb(): Readonly<TimeOfDayTrimModel> { return this.#timeOfDayTrim.model; }
    setTimeOfDayTrimDb(timeOfDay: TimeOfDay, db: number){ this.#timeOfDayTrim.set(timeOfDay, db); }
    /** Linear gain of the current phase's trim. */
    get timeOfDayGain(){ return this.#timeOfDayTrim.gain(this.#timeOfDay); }

    get input(){ return this.#gainNode; }
    get analyser(){ return this.#analyser; }

    get pan(){ return 0; }
    set pan(value: number){ return; }

    close(): void {
        this.stopSpeakerTest();
        for(const clock of this.#clockAudioTracks){
            clock.close();
        }
        this.#stopEffects?.();
        this.#stopMasterSync();
        this.#masters.close();
        this.#dim?.close();
        this.#timeOfDayTrim.close();
        this.#ambienceEngine?.close();
        this.#stingEngine?.close();
        this.#clocksMasterBus.close();
        this.#context.close();
    }
}

/** Mono pink noise (Paul Kellet's filter), peaking at about full scale. */
function createPinkNoise(context: BaseAudioContext, seconds: number): AudioBuffer {
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * seconds), context.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for(let i = 0; i < data.length; i++){
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
    }
    return buffer;
}
