import { AudioStingSlot } from "$lib/audio/client/AudioStingSlot.svelte";
import { AudioTrackGroup } from "$lib/audio/client/AudioTrackGroup";
import type { StingEngineModel, StingEnginePatch } from "$lib/audio/common/model/stingEngineModel";
import type { AudioResourceTrackModel } from "$lib/audio/common/model/audioResourceTrackModel";
import { SSEClient } from "../../model/client/util/sseClient.svelte";

/** Outgoing edits are batched for this long, so dragging a slider doesn't flood the server. */
const SEND_DELAY_MS = 80;

const ENGINE_KEYS = ['gain', 'pan'] as const;
const TRACK_KEYS = ['loadedResourceId'] as const;

export class StingEngine extends AudioTrackGroup<AudioStingSlot> {

    readonly #model: StingEngineModel;
    readonly #silent: boolean;
    readonly #sseConnection: SSEClient;

    #pendingEngine: StingEnginePatch = {};
    #sendTimer: ReturnType<typeof setTimeout> | null = null;

    /**
     * @param model Must be a reactive ($state) model; the slots hold references into it.
     * @param options.silent Track the shared state but never actually play anything.
     */
    constructor(
        model: StingEngineModel,
        outputNode: AudioNode,
        options: { silent?: boolean } = {}
    ) {
        super(
            model,
            outputNode, '',
            (slotModel: AudioResourceTrackModel, outputNode: AudioNode, index: number) => new AudioStingSlot(slotModel, outputNode, `Sting ${index + 1}`)
        );
        this.#model = model;
        this.#silent = options.silent ?? false;

        this.persistMute('sting.bus');

        this.#sseConnection = new SSEClient('/api/stingEngine/events', (msg) => {
            switch (msg.type) {
                case 'stingEngineUpdate':
                    this.applyFields(this.#model, msg.model, ENGINE_KEYS);
                    msg.model.tracks.forEach((t, i) => this.applyRemoteTrack(i, t));
                    break;
                case 'stingTrackUpdate':
                    this.applyRemoteTrack(msg.index, msg.model);
                    break;
                case 'stingTrigger':
                    if (!this.#silent && !this.muted) this.tracks[msg.slot]?.fire();
                    break;
                default:
                    break;
            }
        });
    }

    get model() { return this.#model; }

    get gain(): number { return super.gain; }
    set gain(val: number) {
        super.gain = val;
        this.queueEnginePatch({ gain: this.#model.gain });
    }

    get pan(): number { return super.pan; }
    set pan(val: number) {
        super.pan = val;
        this.queueEnginePatch({ pan: this.#model.pan });
    }

    /** Ask the server to fire whichever slot is currently armed. Playback happens on the SSE echo, like every other client. */
    trigger() {
        fetch('/api/stingEngine/trigger', { method: 'POST' }).then((res) => {
            if (!res.ok) console.error(`StingEngine - trigger rejected: ${res.status}`);
        }).catch((e) => {
            console.error('StingEngine - failed to send trigger', e);
        });
    }

    // ---- Local edits -> server ----

    private queueEnginePatch(patch: StingEnginePatch) {
        Object.assign(this.#pendingEngine, patch);
        this.scheduleSend();
    }

    private scheduleSend() {
        if (this.#sendTimer !== null) return;
        this.#sendTimer = setTimeout(() => {
            this.#sendTimer = null;
            this.flush();
        }, SEND_DELAY_MS);
    }

    private flush() {
        const enginePatch = this.#pendingEngine;
        this.#pendingEngine = {};
        if (Object.keys(enginePatch).length > 0) {
            this.post('/api/stingEngine', enginePatch);
        }
    }

    private post(url: string, body: object) {
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }).then((res) => {
            if (!res.ok) console.error(`StingEngine - update to ${url} rejected: ${res.status}`);
        }).catch((e) => {
            console.error(`StingEngine - failed to send update to ${url}`, e);
        });
    }

    // ---- Server -> local model ----

    private applyFields(target: any, source: any, keys: readonly string[]) {
        for (const k of keys) {
            if (target[k] !== source[k]) target[k] = source[k];
        }
    }

    private applyRemoteTrack(index: number, model: AudioResourceTrackModel) {
        const target = this.#model.tracks[index];
        if (!target) return;
        this.applyFields(target, model, TRACK_KEYS);
    }

    close(): void {
        if (this.#sendTimer !== null) {
            clearTimeout(this.#sendTimer);
            this.#sendTimer = null;
            this.flush();
        }
        this.#sseConnection.close();
        for (const t of this.tracks) t.close();
        super.close();
    }
}
