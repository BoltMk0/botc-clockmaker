import type { AmbienceTrackPatch } from "$lib/audio/common/model/ambienceEngineModel";
import type { AmbienceTrackModel } from "$lib/audio/common/model/ambienceTrackModel";
import { AudioTrack } from "./AudioTrack.svelte";

/** Duration of the fade when a track becomes active / inactive. */
const FADE_MS = 3000;
const FADE_CURVE_POINTS = 128;
/** Time constant of the change in level when the front or rear is switched on or off (or the speaker layout changes). */
const OUTPUT_TIME_CONSTANT_S = 0.15;

/**
 * Plays by decoding the whole file into an AudioBuffer and looping it with an AudioBufferSourceNode, rather than
 * via <audio loop>: buffer looping is sample-accurate, so compressed formats (AAC/MP3) loop without the gap their
 * encoder padding otherwise leaves at the loop point.
 *
 * Four channels (4.0): the loop plays twice, from the same buffer - once to the front pair, and once to the rear pair half
 * its length further on, so the two don't sound alike. Both always play, in step; which pairs are heard is only a matter
 * of their levels (see `outputFront` and `outputRear`).
 */
export class AudioAmbienceTrack extends AudioTrack {
    readonly #context: BaseAudioContext;
    readonly #model: AmbienceTrackModel;
    readonly #stopEffects: ()=>void;
    // Separate from the fader gain, so fades don't fight user gain changes. One for each of the front and rear loops.
    readonly #fadeNodes: [GainNode, GainNode];
    #buffer: AudioBuffer|null = null;
    #sources: AudioBufferSourceNode[] = [];
    #loadAbort: AbortController|null = null;
    #wantPlaying = false;
    #pauseTimer: ReturnType<typeof setTimeout>|null = null;

    /** Called with the changed fields whenever the user edits this track locally (used to sync to the server). */
    onLocalChange: ((patch: AmbienceTrackPatch)=>void)|null = null;

    /**
     * @param options.silent Never plays, so its audio is never fetched either.
     * @param options.surround Reactive getter for whether this device plays 4.0: if not, the track plays once, at the
     *   front, if it's set to play from either.
     */
    constructor(
        model: AmbienceTrackModel,
        outputNode: AudioNode,
        title: string,
        options: {silent?: boolean, surround?: ()=>boolean} = {}
    ) {
        super(model, outputNode, title, {quad: true});
        this.#model = model;
        this.#context = outputNode.context;

        const quad = this.quad!;
        this.#fadeNodes = [this.#context.createGain(), this.#context.createGain()];
        for(const fade of this.#fadeNodes) fade.gain.value = 0;
        this.#fadeNodes[0].connect(quad.frontInput);
        this.#fadeNodes[1].connect(quad.rearInput);

        const surround = options.surround ?? (()=>false);
        this.#stopEffects = options.silent ? ()=>{} : $effect.root(()=>{
            $effect(()=>{
                const id = this.#model.loadedResourceId;
                this.load(id);
            });
            $effect(()=>{
                const {outputFront, outputRear} = this.#model;
                const quadOutput = surround();
                const front = quadOutput ? outputFront : outputFront || outputRear;
                const rear = quadOutput && outputRear;
                const now = this.#context.currentTime;
                quad.front.gain.setTargetAtTime(front ? 1 : 0, now, OUTPUT_TIME_CONSTANT_S);
                quad.rear.gain.setTargetAtTime(rear ? 1 : 0, now, OUTPUT_TIME_CONSTANT_S);
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
        for(const source of this.#sources){
            try { source.stop(); } catch { /* never started */ }
            source.disconnect();
        }
        this.#sources = [];
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

    get activeInMorning(): boolean { return this.#model.activeInMorning; }
    set activeInMorning(value: boolean){
        this.#model.activeInMorning = value;
        this.onLocalChange?.({activeInMorning: value});
    }

    get activeInDay(): boolean { return this.#model.activeInDay; }
    set activeInDay(value: boolean){
        this.#model.activeInDay = value;
        this.onLocalChange?.({activeInDay: value});
    }

    get outputFront(): boolean { return this.#model.outputFront; }
    /** Ignored if it would leave the track playing from neither the front nor the rear. */
    set outputFront(value: boolean){
        if(!value && !this.#model.outputRear) return;
        this.#model.outputFront = value;
        this.onLocalChange?.({outputFront: value});
    }

    get outputRear(): boolean { return this.#model.outputRear; }
    /** Ignored if it would leave the track playing from neither the front nor the rear. */
    set outputRear(value: boolean){
        if(!value && !this.#model.outputFront) return;
        this.#model.outputRear = value;
        this.onLocalChange?.({outputRear: value});
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
        // The front and rear loops fade together, so both fade nodes always hold the same value
        const params = this.#fadeNodes.map(fade=>fade.gain);
        const now = this.#context.currentTime;
        const current = Math.min(1, Math.max(0, params[0].value)); // Reflects any fade in progress
        for(const param of params) param.cancelScheduledValues(now);

        // Where on the curve the current gain sits, so a reversed fade continues smoothly from it
        const start = target === 1 ? Math.asin(current) / (Math.PI / 2) : Math.acos(current) / (Math.PI / 2);
        const remaining = 1 - start;
        if(remaining < 0.001){
            for(const param of params) param.setValueAtTime(target, now);
            return;
        }
        const curve = new Float32Array(FADE_CURVE_POINTS);
        for(let i = 0; i < FADE_CURVE_POINTS; i++){
            const angle = (start + remaining * i / (FADE_CURVE_POINTS - 1)) * Math.PI / 2;
            curve[i] = target === 1 ? Math.sin(angle) : Math.cos(angle);
        }
        // As ramps between the curve's points rather than setValueCurveAtTime: Firefox doesn't cancel a curve already
        // under way, and then refuses any event during it, so turning a fade round partway would throw
        const step = FADE_MS / 1000 * remaining / (FADE_CURVE_POINTS - 1);
        for(const param of params){
            param.setValueAtTime(curve[0], now);
            for(let i = 1; i < FADE_CURVE_POINTS; i++) param.linearRampToValueAtTime(curve[i], now + i * step);
        }
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
        if(this.#sources.length > 0) return;
        if(this.#buffer === null) return; // load() will call back in once decoded

        const buffer = this.#buffer;
        // Random start position, so tracks don't always open on the same moment; the rear loop half its length on.
        // Both start at the same time, so they stay in step.
        const offset = buffer.duration * Math.random();
        const when = this.#context.currentTime;
        this.#sources = this.#fadeNodes.map((fade, i)=>{
            const source = this.#context.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            source.connect(fade);
            source.start(when, (offset + i * buffer.duration / 2) % buffer.duration);
            return source;
        });
    }

    close(): void {
        this.#stopEffects();
        this.clearPauseTimer();
        this.#loadAbort?.abort();
        this.stopSource();
        this.#buffer = null;
        for(const fade of this.#fadeNodes) fade.disconnect();
        super.close();
    }
}
