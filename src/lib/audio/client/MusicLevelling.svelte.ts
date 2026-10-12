import { DEFAULT_MUSIC_LEVELLING, type MusicLevellingModel } from "$lib/audio/common/model/musicModel";
import { subscribeMixerEvents } from "./MixerEventsClient";

/** Client side of the music player's loudness levelling settings: follows the server's, and can change them for everyone. */
export class MusicLevelling {
    model = $state<MusicLevellingModel>({ ...DEFAULT_MUSIC_LEVELLING });

    readonly #unsubscribeEvents: () => void;

    constructor() {
        this.#unsubscribeEvents = subscribeMixerEvents((msg) => {
            if (msg.type === 'musicUpdate') this.model = msg.model.levelling;
        });
    }

    get enabled() { return this.model.enabled; }
    get targetLufs() { return this.model.targetLufs; }

    set enabled(enabled: boolean) {
        this.model.enabled = enabled; // Optimistic; the server's echo confirms it
        this.#send({ enabled });
    }

    set targetLufs(targetLufs: number) {
        this.model.targetLufs = targetLufs;
        this.#send({ targetLufs });
    }

    #send(patch: Partial<MusicLevellingModel>) {
        fetch('/api/music/levelling', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch)
        }).then((res) => {
            if (!res.ok) console.error(`MusicLevelling - update rejected: ${res.status}`);
        }).catch((e) => {
            console.error('MusicLevelling - failed to send update', e);
        });
    }

    close() { this.#unsubscribeEvents(); }
}
