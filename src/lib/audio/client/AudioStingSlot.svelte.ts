import type { AudioResourceTrackModel } from "$lib/audio/common/model/audioResourceTrackModel";
import { AudioTrack } from "./AudioTrack.svelte";

/** One of the two alternating players in a sting track: holds one asset, ready to fire instantly. */
export class AudioStingSlot extends AudioTrack {
    readonly audioSource: MediaElementAudioSourceNode;
    readonly audio: HTMLAudioElement;
    readonly #model: AudioResourceTrackModel;
    readonly #stopEffects: () => void;

    constructor(
        model: AudioResourceTrackModel,
        outputNode: AudioNode,
        title: string
    ) {
        super(model, outputNode, title);
        this.#model = model;
        this.audio = new Audio();

        this.audio.onerror = () => {
            console.error(`AudioStingSlot - ERROR: ${this.audio.error?.message ?? "unknown error"}`);
        }

        const context = (outputNode.context as AudioContext);
        this.audioSource = context.createMediaElementSource(this.audio);
        this.audioSource.connect(this.input);

        this.#stopEffects = $effect.root(() => {
            $effect(() => {
                const id = this.#model.loadedResourceId;
                if (id === null) {
                    this.audio.pause();
                    this.audio.removeAttribute('src');
                    this.audio.load();
                } else {
                    this.audio.src = `/api/resources/${id}`;
                }
            });
        });
    }

    get loadedResourceId(): string | null { return this.#model.loadedResourceId; }

    /** Play this slot's loaded asset from the start, right now. */
    fire() {
        if (this.#model.loadedResourceId === null) return;
        this.audio.currentTime = 0;
        this.audio.play().catch((e) => {
            // Typically NotAllowedError before this device has had a user gesture.
            console.warn(`AudioStingSlot - play() failed: ${e?.message ?? e}`);
        });
    }

    close(): void {
        this.#stopEffects();
        this.audio.pause();
        this.audio.removeAttribute('src');
        this.audio.load();
        this.audioSource.disconnect();
        super.close();
    }
}
