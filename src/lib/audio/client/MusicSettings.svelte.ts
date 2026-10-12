import { DEFAULT_MUSIC_CROSSFADE, DEFAULT_MUSIC_LEVELLING, type MusicCrossfadeModel, type MusicLevellingModel } from "$lib/audio/common/model/musicModel";
import { subscribeMixerEvents } from "./MixerEventsClient";

/**
 * Client side of the music player's settings (loudness levelling and crossfading): follows the server's, and can
 * change them for everyone.
 */
export class MusicSettings {
    levelling = $state<MusicLevellingModel>({ ...DEFAULT_MUSIC_LEVELLING });
    crossfade = $state<MusicCrossfadeModel>({ ...DEFAULT_MUSIC_CROSSFADE });

    readonly #unsubscribeEvents: () => void;

    constructor() {
        this.#unsubscribeEvents = subscribeMixerEvents((msg) => {
            if (msg.type !== 'musicUpdate') return;
            this.levelling = msg.model.levelling;
            this.crossfade = msg.model.crossfade;
        });
    }

    updateLevelling(patch: Partial<MusicLevellingModel>) {
        this.levelling = { ...this.levelling, ...patch }; // Optimistic; the server's echo confirms it
        this.#send('/api/music/levelling', patch);
    }

    updateCrossfade(patch: Partial<MusicCrossfadeModel>) {
        this.crossfade = { ...this.crossfade, ...patch };
        this.#send('/api/music/crossfade', patch);
    }

    #send(url: string, patch: object) {
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch)
        }).then((res) => {
            if (!res.ok) console.error(`MusicSettings - update rejected: ${res.status}`);
        }).catch((e) => {
            console.error('MusicSettings - failed to send update', e);
        });
    }

    close() { this.#unsubscribeEvents(); }
}
