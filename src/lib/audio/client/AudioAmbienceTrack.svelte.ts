import type { AmbienceTrackPatch } from "$lib/audio/common/model/ambienceEngineModel";
import type { AmbienceTrackModel } from "$lib/audio/common/model/ambienceTrackModel";
import { AudioTrack } from "./AudioTrack.svelte";

/** Duration of the fade when a track becomes active / inactive. */
const FADE_MS = 3000;
const FADE_CURVE_POINTS = 128;

export class AudioAmbienceTrack extends AudioTrack {
    readonly audioSource: MediaElementAudioSourceNode;
    readonly audio: HTMLAudioElement;
    readonly #model: AmbienceTrackModel;
    readonly #stopEffects: ()=>void;
    readonly #fadeNode: GainNode; // Separate from the fader gain, so fades don't fight user gain changes
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
        this.audio = new Audio();

        this.audio.onerror = ()=>{
            console.error(`AudioAmbienceTrack - ERROR: ${this.audio.error?.message ?? "unknown error"}`);
        }
        this.audio.onloadstart = (ev)=>{
            console.debug(`AudioAmbienceTrack - Loading audio: ${this.audio.src}`);
        }
        this.audio.onloadedmetadata = ()=>{
            // Duration is only known now, so this is the earliest a random start position can be picked.
            this.applyPlayback();
        }
        this.audio.onloadeddata = (ev)=>{
            console.debug(`AudioAmbienceTrack - Finished loading audio. Duration ${this.audio.duration}s`);
        }
        this.audio.onplaying = (()=>{
            console.debug(`AudioAmbienceTrack - Is playing`, this.audio.src);
        });

        this.audio.loop = true;

        const context = (outputNode.context as AudioContext);
        this.audioSource = context.createMediaElementSource(this.audio);

        this.#fadeNode = context.createGain();
        this.#fadeNode.gain.value = 0;
        this.audioSource.connect(this.#fadeNode).connect(this.input);

        this.#stopEffects = $effect.root(()=>{
            $effect(()=>{
                const id = this.#model.loadedResourceId;
                if(id === null){
                    this.audio.pause();
                    this.audio.removeAttribute('src');
                    this.audio.load();
                } else {
                    this.audio.src = `/api/resources/${id}`;
                }
            });
        });
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
                if(!this.#wantPlaying) this.audio.pause();
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

    /** Re-attempt playback, e.g. after the browser's autoplay policy is satisfied by a user gesture. */
    applyPlayback(){
        if(this.#model.loadedResourceId === null){
            this.audio.pause();
            return;
        }
        if(!this.#wantPlaying) return; // Pausing after a fade-out is handled by setPlaying
        if(!this.audio.paused) return;
        if(this.audio.readyState < HTMLMediaElement.HAVE_METADATA) return; // onloadedmetadata will call back in

        if(Number.isFinite(this.audio.duration) && this.audio.duration > 0){
            this.audio.currentTime = this.audio.duration * Math.random();
        }
        this.audio.play().catch((e)=>{
            // Typically NotAllowedError before the first user gesture; retried via applyPlayback() on resume.
            console.warn(`AudioAmbienceTrack - play() failed: ${e?.message ?? e}`);
        });
    }

    close(): void {
        this.#stopEffects();
        this.clearPauseTimer();
        this.audio.pause();
        this.audio.removeAttribute('src');
        this.audio.load();
        this.audioSource.disconnect();
        super.close();
    }
}
