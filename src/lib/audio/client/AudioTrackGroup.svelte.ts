import type { AudioTrackGroupModel } from "../common/model/audioTrackGroupModel.svelte";
import { AudioTrack } from "./AudioTrack.svelte";

export class AudioTrackGroup<T extends AudioTrack = AudioTrack> extends AudioTrack {
    // Reactive, so subclasses whose track count can change (the ambience engine) are re-rendered when it does.
    #tracks: T[] = $state([]);

    constructor(
        model: AudioTrackGroupModel,
        outputNode: AudioNode,
        title: string,
        newAudioTrackFn: (model: any, outputNode: AudioNode, index: number)=>T,
        options: {quad?: boolean} = {}
    ) {
        super(model, outputNode, title, options);
        this.#tracks = Array.from(model.tracks, (t, i)=>newAudioTrackFn(t, this.input, i));
    }

    get tracks(): T[] { return this.#tracks; }
}
