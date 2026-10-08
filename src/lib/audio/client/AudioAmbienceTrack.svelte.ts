import type { AmbienceTrackPatch } from "$lib/audio/common/model/ambienceEngineModel";
import type { AmbienceTrackModel } from "$lib/audio/common/model/ambienceTrackModel";
import { AudioTrack } from "./AudioTrack.svelte";

/** Duration of the fade when a track becomes active / inactive. */
const FADE_MS = 3000;
const FADE_CURVE_POINTS = 128;

/**
 * Plays by decoding the whole file into an AudioBuffer and looping it with an AudioBufferSourceNode, rather than
 * via <audio loop>: buffer looping is sample-accurate, so compressed formats (AAC/MP3) loop without the gap their
 * encoder padding otherwise leaves at the loop point.
 */
export class AudioAmbienceTrack extends AudioTrack {
    readonly #context: BaseAudioContext;
    readonly #model: AmbienceTrackModel;
    readonly #stopEffects: ()=>void;
    readonly #fadeNode: GainNode; // Separate from the fader gain, so fades don't fight user gain changes
    #buffer: AudioBuffer|null = null;
    #source: AudioBufferSourceNode|null = null;
    #loadAbort: AbortController|null = null;
    #wantPlaying = false;
    #pauseTimer: ReturnType<typeof setTimeout>|null = null;

    /** Called with the changed fields whenever the user edits this track locally (used to sync to the server). */
    onLocalChange: ((patch: AmbienceTrackPatch)=>void)|null = null;

    constructor(
        model: AmbienceTrackModel,
        outputNode: AudioNode,
        title: string
    ) {
        super(model, outputNode, title);
        this.#model = model;
        this.#context = outputNode.context;

        this.#fadeNode = this.#context.createGain();
        this.#fadeNode.gain.value = 0;
        this.#fadeNode.connect(this.input);

        this.#stopEffects = $effect.root(()=>{
            $effect(()=>{
                const id = this.#model.loadedResourceId;
                this.load(id);
            });
        });
    }

    /** Swap to a new resource: drop the current buffer, then fetch and decode the new one in the background. */
    private load(id: string|null){
        this.#loadAbort?.abort();
        this.#loadAbort = null;
        this.stopSource();
        this.#buffer = null;
        if(id === null) return;

        const abort = new AbortController();
        this.#loadAbort = abort;
        const url = `/api/resources/${id}`;
        console.debug(`AudioAmbienceTrack - Loading audio: ${url}`);
        fetch(url, { signal: abort.signal })
            .then((res)=>{
                if(!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.arrayBuffer();
            })
            .then((data)=>this.#context.decodeAudioData(data))
            .then((buffer)=>{
                if(abort.signal.aborted) return; // Superseded by a later load while decoding
                this.#loadAbort = null;
                this.#buffer = buffer;
                console.debug(`AudioAmbienceTrack - Finished loading audio. Duration ${buffer.duration}s`);
                this.applyPlayback();
            })
            .catch((e)=>{
                if(abort.signal.aborted) return;
                console.error(`AudioAmbienceTrack - ERROR loading ${url}: ${e?.message ?? e}`);
            });
    }

    private stopSource(){
        if(this.#source === null) return;
        try { this.#source.stop(); } catch { /* never started */ }
        this.#source.disconnect();
        this.#source = null;
    }

    get gain(): number { return super.gain; }
    set gain(val: number) {
        super.gain = val;
        this.onLocalChange?.({gain: this.#model.gain});
    }

    get pan(): number { return super.pan; }
    set pan(val: number) {
        super.pan = val;
        this.onLocalChange?.({pan: this.#model.pan});
    }

    get activeAtNight(): boolean { return this.#model.activeAtNight; }
    set activeAtNight(value: boolean){
        this.#model.activeAtNight = value;
        this.onLocalChange?.({activeAtNight: value});
    }

    get activeAtDusk(): boolean { return this.#model.activeAtDusk; }
    set activeAtDusk(value: boolean){
        this.#model.activeAtDusk = value;
        this.onLocalChange?.({activeAtDusk: value});
    }

    get activeInDay(): boolean { return this.#model.activeInDay; }
    set activeInDay(value: boolean){
        this.#model.activeInDay = value;
        this.onLocalChange?.({activeInDay: value});
    }

    get loadedResourceId(): string|null { return this.#model.loadedResourceId; }
    set loadedResourceId(res: string|null) {
        this.#model.loadedResourceId = res; // The src effect picks this up
        this.onLocalChange?.({loadedResourceId: res});
    }

    /** Declare whether this track should currently be audible. Fades in/out on change; safe to call repeatedly. */
    setPlaying(want: boolean){
        const changed = want !== this.#wantPlaying;
        this.#wantPlaying = want;
        if(want){
            this.clearPauseTimer();
            this.applyPlayback();
        }
        if(!changed) return;
        this.fadeTo(want ? 1 : 0);
        if(!want){
            // Only stop the element once it has faded out
            this.#pauseTimer = setTimeout(()=>{
                this.#pauseTimer = null;
                if(!this.#wantPlaying) this.stopSource();
            }, FADE_MS);
        }
    }

    private clearPauseTimer(){
        if(this.#pauseTimer !== null){
            clearTimeout(this.#pauseTimer);
            this.#pauseTimer = null;
        }
    }

    /**
     * Equal-power fade: in follows sin(t·π/2) and out follows cos(t·π/2), so a fading-out and a fading-in track
     * (e.g. at the day/night switch) sum to constant power rather than dipping in the middle like linear ramps.
     */
    private fadeTo(target: 0|1){
        const param = this.#fadeNode.gain;
        const now = this.#fadeNode.context.currentTime;
        const current = Math.min(1, Math.max(0, param.value)); // Reflects any fade in progress
        param.cancelScheduledValues(now);

        // Where on the curve the current gain sits, so a reversed fade continues smoothly from it
        const start = target === 1 ? Math.asin(current) / (Math.PI / 2) : Math.acos(current) / (Math.PI / 2);
        const remaining = 1 - start;
        if(remaining < 0.001){
            param.setValueAtTime(target, now);
            return;
        }
        const curve = new Float32Array(FADE_CURVE_POINTS);
        for(let i = 0; i < FADE_CURVE_POINTS; i++){
            const angle = (start + remaining * i / (FADE_CURVE_POINTS - 1)) * Math.PI / 2;
            curve[i] = target === 1 ? Math.sin(angle) : Math.cos(angle);
        }
        param.setValueCurveAtTime(curve, now, FADE_MS / 1000 * remaining);
    }

    /**
     * Start the loop if it should be playing and isn't yet. Safe to call repeatedly. A source started while the
     * AudioContext is still suspended (before the first user gesture) simply begins sounding once it resumes.
     */
    applyPlayback(){
        if(this.#model.loadedResourceId === null){
            this.stopSource();
            return;
        }
        if(!this.#wantPlaying) return; // Stopping after a fade-out is handled by setPlaying
        if(this.#source !== null) return;
        if(this.#buffer === null) return; // load() will call back in once decoded

        const source = this.#context.createBufferSource();
        source.buffer = this.#buffer;
        source.loop = true;
        source.connect(this.#fadeNode);
        // Random start position, so tracks don't always open on the same moment
        source.start(0, this.#buffer.duration * Math.random());
        this.#source = source;
    }

    close(): void {
        this.#stopEffects();
        this.clearPauseTimer();
        this.#loadAbort?.abort();
        this.stopSource();
        this.#buffer = null;
        this.#fadeNode.disconnect();
        super.close();
    }
}
