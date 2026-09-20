import { AudioAmbienceTrack } from "$lib/audio/client/AudioAmbienceTrack.svelte";
import { AudioTrackGroup } from "$lib/audio/client/AudioTrackGroup";
import type { AmbienceEngineModel, AmbienceEnginePatch, AmbienceTrackPatch } from "$lib/audio/common/model/ambienceEngineModel";
import type { AmbienceTrackModel } from "$lib/audio/common/model/ambienceTrackModel";
import type { TimeOfDay } from "../../model/client/types";
import { SSEClient } from "../../model/client/util/sseClient.svelte";

/** Outgoing edits are batched for this long, so dragging a slider doesn't flood the server. */
const SEND_DELAY_MS = 80;
/** Incoming values for a field are ignored for this long after editing it locally, so stale echoes don't fight the user's slider. */
const LOCAL_EDIT_HOLD_MS = 500;

const ENGINE_KEYS = ['playing', 'gain', 'pan'] as const;
const TRACK_KEYS = ['gain', 'pan', 'activeInDay', 'activeAtNight', 'loadedResourceId'] as const;

export class AmbienceEngine extends AudioTrackGroup<AudioAmbienceTrack> {

    readonly #model: AmbienceEngineModel;
    readonly #timeOfDay: ()=>TimeOfDay;
    readonly #sseConnection: SSEClient;
    readonly #stopEffects: ()=>void;

    #pendingEngine: AmbienceEnginePatch = {};
    #pendingTracks = new Map<number, AmbienceTrackPatch>();
    #sendTimer: ReturnType<typeof setTimeout>|null = null;
    #localEdits = new Map<string, number>();

    /**
     * @param model Must be a reactive ($state) model; the tracks hold references into it.
     * @param timeOfDay Reactive getter for the current time of day (across all games).
     */
    constructor(
        model: AmbienceEngineModel,
        outputNode: AudioNode,
        timeOfDay: ()=>TimeOfDay
    ) {
        super(
            model,
            outputNode, '',
            (model: AmbienceTrackModel, outputNode: AudioNode, index: number)=>new AudioAmbienceTrack(model, outputNode, `Track ${index + 1}`)
        );
        this.#model = model;
        this.#timeOfDay = timeOfDay;

        this.persistMute('ambience.bus');
        this.tracks.forEach((track, index)=>{
            track.persistMute(`ambience.track.${index}`);
            track.onLocalChange = (patch)=>this.queueTrackPatch(index, patch);
        });

        // Drive playback from (shared playing flag) x (time of day) x (per-track day/night activity).
        this.#stopEffects = $effect.root(()=>{
            $effect(()=>{
                const playing = this.#model.playing;
                const timeOfDay = this.#timeOfDay();
                for(const t of this.tracks){
                    t.setPlaying(playing && (timeOfDay === 'day' ? t.activeInDay : t.activeAtNight));
                }
            });
        });

        this.#sseConnection = new SSEClient('/api/ambienceEngine/events', (msg)=>{
            switch(msg.type){
                case 'ambienceEngineUpdate':
                    this.applyRemoteEngine(msg.model);
                    break;
                case 'ambienceTrackUpdate':
                    this.applyRemoteTrack(msg.index, msg.model);
                    break;
                default:
                    break;
            }
        });
    }

    get model() { return this.#model; }
    get timeOfDay(): TimeOfDay { return this.#timeOfDay(); }
    get playing() { return this.#model.playing; }

    set playing(playing: boolean){
        this.#model.playing = playing;
        this.queueEnginePatch({playing});
    }

    get gain(): number { return super.gain; }
    set gain(val: number) {
        super.gain = val;
        this.queueEnginePatch({gain: this.#model.gain});
    }

    get pan(): number { return super.pan; }
    set pan(val: number) {
        super.pan = val;
        this.queueEnginePatch({pan: this.#model.pan});
    }

    play(){ this.playing = true; }
    pause(){ this.playing = false; }
    togglePlayPause() { this.playing = !this.playing; }

    /** Retry playback of all tracks (call after a user gesture, once the browser permits audio). */
    retryPlayback(){
        for(const t of this.tracks) t.applyPlayback();
    }

    // ---- Local edits -> server ----

    private queueEnginePatch(patch: AmbienceEnginePatch){
        Object.assign(this.#pendingEngine, patch);
        this.markLocalEdit('engine', Object.keys(patch));
        this.scheduleSend();
    }

    private queueTrackPatch(index: number, patch: AmbienceTrackPatch){
        this.#pendingTracks.set(index, {...this.#pendingTracks.get(index), ...patch});
        this.markLocalEdit(`track.${index}`, Object.keys(patch));
        this.scheduleSend();
    }

    private markLocalEdit(prefix: string, keys: string[]){
        const now = Date.now();
        for(const k of keys) this.#localEdits.set(`${prefix}.${k}`, now);
    }

    private scheduleSend(){
        if(this.#sendTimer !== null) return;
        this.#sendTimer = setTimeout(()=>{
            this.#sendTimer = null;
            this.flush();
        }, SEND_DELAY_MS);
    }

    private flush(){
        const enginePatch = this.#pendingEngine;
        const trackPatches = [...this.#pendingTracks];
        this.#pendingEngine = {};
        this.#pendingTracks.clear();
        if(Object.keys(enginePatch).length > 0){
            this.post('/api/ambienceEngine', enginePatch);
        }
        for(const [index, patch] of trackPatches){
            this.post(`/api/ambienceEngine/tracks/${index}`, patch);
        }
    }

    private post(url: string, body: object){
        fetch(url, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(body)
        }).then((res)=>{
            if(!res.ok) console.error(`AmbienceEngine - update to ${url} rejected: ${res.status}`);
        }).catch((e)=>{
            console.error(`AmbienceEngine - failed to send update to ${url}`, e);
        });
    }

    // ---- Server -> local model ----

    private applyFields(prefix: string, target: any, source: any, keys: readonly string[]){
        const now = Date.now();
        for(const k of keys){
            const editedAt = this.#localEdits.get(`${prefix}.${k}`);
            if(editedAt !== undefined && now - editedAt < LOCAL_EDIT_HOLD_MS) continue;
            if(target[k] !== source[k]) target[k] = source[k];
        }
    }

    private applyRemoteEngine(model: AmbienceEngineModel){
        this.applyFields('engine', this.#model, model, ENGINE_KEYS);
        model.tracks.forEach((t, i)=>this.applyRemoteTrack(i, t));
    }

    private applyRemoteTrack(index: number, model: AmbienceTrackModel){
        const target = this.#model.tracks[index];
        if(!target) return;
        this.applyFields(`track.${index}`, target, model, TRACK_KEYS);
    }

    close(): void {
        this.#stopEffects();
        if(this.#sendTimer !== null){
            clearTimeout(this.#sendTimer);
            this.#sendTimer = null;
            this.flush(); // Don't lose the last edit
        }
        this.#sseConnection.close();
        for(const t of this.tracks) t.close();
        super.close();
    }
}
