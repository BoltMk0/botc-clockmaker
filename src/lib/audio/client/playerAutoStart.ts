/** How long after a page opens a remembered player waits for the host role to come free (e.g. the page it ran on before is still letting it go). */
const AUTO_START_WINDOW_MS = 30000;

const storageKey = (kind: string, what: 'hosting' | 'playing') => `mixer.player.${kind}.${what}`;

/**
 * Remembers, on this device, whether it was running a player (the music or Spotify one), so a page that can run it
 * starts it again by itself when it opens - unless another device has taken it over meanwhile - and what it was playing
 * (`T`, e.g. the preset), to play that again then. Stopping the player by hand forgets both; leaving the page doesn't.
 */
export class PlayerAutoStart<T> {
    readonly #kind: string;
    #pending: boolean;
    readonly #deadline = Date.now() + AUTO_START_WINDOW_MS;
    /** What to play again once the player's started by itself, until it's been asked for (see takeRestore). */
    #restore: T | null = null;
    #restoring = false;
    /** As last stored, so an unchanged state isn't written again on every update. */
    #storedPlaying: string | null;

    constructor(kind: 'music' | 'spotify', canHost: boolean) {
        this.#kind = kind;
        this.#pending = canHost && this.#read('hosting') === '1';
        this.#storedPlaying = this.#read('playing');
    }

    /** Call on each update of the player's state: whether to start it now (only ever once, while the host role is free). */
    shouldStart(hostFree: boolean): boolean {
        if (!this.#pending) return false;
        if (Date.now() > this.#deadline) {
            this.#pending = false;
            return false;
        }
        if (!hostFree) return false;
        this.#pending = false;
        // What it was playing, to start again once it's running
        try {
            this.#restore = this.#storedPlaying ? JSON.parse(this.#storedPlaying) as T : null;
        } catch {
            this.#restore = null;
        }
        this.#restoring = this.#restore !== null;
        return true;
    }

    /** What to play again, once (null if it wasn't started by itself, or nothing was playing). */
    takeRestore(): T | null {
        const restore = this.#restore;
        this.#restore = null;
        this.#restoring = false;
        return restore;
    }

    /** While the player's running here: what it's playing (null for nothing, or paused). Ignored until it's been restored. */
    rememberPlaying(playing: T | null) {
        if (this.#restoring) return;
        const value = playing === null ? null : JSON.stringify(playing);
        if (value === this.#storedPlaying) return;
        this.#storedPlaying = value;
        this.#write('playing', value);
    }

    remember(hosting: boolean) {
        this.#pending = false;
        this.#write('hosting', hosting ? '1' : null);
        if (!hosting) {
            this.#restore = null;
            this.#restoring = false;
            this.#storedPlaying = null;
            this.#write('playing', null);
        }
    }

    #read(what: 'hosting' | 'playing'): string | null {
        try {
            return localStorage.getItem(storageKey(this.#kind, what));
        } catch {
            return null;
        }
    }

    #write(what: 'hosting' | 'playing', value: string | null) {
        try {
            if (value === null) localStorage.removeItem(storageKey(this.#kind, what));
            else localStorage.setItem(storageKey(this.#kind, what), value);
        } catch { /* storage unavailable */ }
    }
}
