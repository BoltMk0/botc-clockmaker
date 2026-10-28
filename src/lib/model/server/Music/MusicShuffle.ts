import { JSONSingletonResourceManager } from "$lib/resources/server/jsonResourceManager";

/** A playlist's shuffled running order, and how far through it playback has got. */
type ShuffleState = {
    order: string[];
    /** Index in `order` of the track last started (-1 before the first). */
    index: number;
    /** A track moved up by hand to play next, so it plays then even if it was heard recently. */
    queued?: string;
};

function isShuffleStates(data: unknown): data is Record<string, ShuffleState> {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return false;
    return Object.values(data).every(s => typeof s === 'object' && s !== null && Array.isArray(s.order) &&
        s.order.every((id: unknown) => typeof id === 'string') && Number.isInteger(s.index) &&
        (s.queued === undefined || typeof s.queued === 'string'));
}

function isTrackIds(data: unknown): data is string[] {
    return Array.isArray(data) && data.every(id => typeof id === 'string');
}

/** Kept on disk, so a restart doesn't start every playlist's shuffle over. */
const SHUFFLE_MANAGER = new JSONSingletonResourceManager<Record<string, ShuffleState>>('music_shuffle', isShuffleStates);
/** The tracks started most recently, on any playlist, oldest first. */
const RECENT_MANAGER = new JSONSingletonResourceManager<string[]>('music_recent', isTrackIds);
const RECENT_TRACKS = 20;

function shuffled<T>(items: T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

/**
 * Each playlist plays in a shuffled order that it remembers its place in, so switching away and back carries on with
 * tracks not yet heard rather than repeating ones that were. Once every track has played it's reshuffled.
 *
 * Playlists share tracks, so the last few started on any of them are put off till later: changing preset doesn't
 * repeat what was just heard on the other playlist, and a new round doesn't start with what ended the last.
 */
export class MusicShuffle {
    #states(): Record<string, ShuffleState> {
        return SHUFFLE_MANAGER.value ?? {};
    }

    #save(playlistId: string, state: ShuffleState) {
        SHUFFLE_MANAGER.save({ ...this.#states(), [playlistId]: state });
    }

    /** Notes a track's been started, whichever way it was picked. */
    played(trackId: string) {
        const recent = (RECENT_MANAGER.value ?? []).filter(id => id !== trackId);
        recent.push(trackId);
        RECENT_MANAGER.save(recent.slice(-RECENT_TRACKS));
    }

    /**
     * Brings forward to `at` the first track from there on that wasn't heard recently - or, if they all were, the one
     * heard longest ago. Only the most recently heard two thirds of the playlist's tracks count as recent, so a short
     * playlist (or one mostly heard lately) still has some shuffle to it rather than settling into the same order.
     */
    #preferUnheard(order: string[], at: number, trackIds: string[]) {
        const onList = new Set(trackIds);
        const heard = (RECENT_MANAGER.value ?? []).filter(id => onList.has(id));
        const avoid = heard.slice(heard.length - Math.min(heard.length, Math.floor(trackIds.length * 2 / 3)));
        let best = at;
        for (let i = at; i < order.length && avoid.includes(order[best]); i++) {
            if (avoid.indexOf(order[i]) < avoid.indexOf(order[best])) best = i;
        }
        if (best !== at) order.splice(at, 0, ...order.splice(best, 1));
    }

    /**
     * The playlist's state brought up to date with its tracks: ones taken off it are dropped (keeping the place), and
     * ones added since are slotted in at random among those still to play.
     */
    #current(playlistId: string, trackIds: string[]): ShuffleState {
        const saved = this.#states()[playlistId] ?? { order: [], index: -1 };
        const valid = new Set(trackIds);
        const order = saved.order.filter(id => valid.has(id));
        const index = saved.order.slice(0, saved.index + 1).filter(id => valid.has(id)).length - 1;
        const known = new Set(order);
        for (const id of shuffled(trackIds.filter(id => !known.has(id)))) {
            const at = index + 1 + Math.floor(Math.random() * (order.length - index));
            order.splice(at, 0, id);
        }
        return { order, index, queued: saved.queued };
    }

    /** Moves on to the playlist's next track and returns it (null if the playlist is empty). */
    next(playlistId: string, trackIds: string[]): string | null {
        if (trackIds.length === 0) return null;
        const state = this.#current(playlistId, trackIds);
        let { order, index } = state;
        index++;
        if (index >= order.length) {
            order = shuffled(trackIds);
            index = 0;
        }
        if (order[index] !== state.queued) this.#preferUnheard(order, index, trackIds);
        this.#save(playlistId, { order, index });
        return order[index];
    }

    /**
     * Moves a track up to play next, the rest of the order carrying on as it was (one already heard this round is
     * taken from where it was, so it isn't heard twice). Does nothing if it's not on the playlist.
     */
    playNext(playlistId: string, trackIds: string[], trackId: string) {
        if (!trackIds.includes(trackId)) return;
        let { order, index } = this.#current(playlistId, trackIds);
        const at = order.indexOf(trackId);
        order = order.filter(id => id !== trackId);
        if (at <= index) index--;
        order.splice(index + 1, 0, trackId);
        this.#save(playlistId, { order, index, queued: trackId });
    }

    /** Steps back to the track before the last one started, or that one again if it was the first; null if empty. */
    previous(playlistId: string, trackIds: string[]): string | null {
        if (trackIds.length === 0) return null;
        const state = this.#current(playlistId, trackIds);
        if (state.index < 0) return this.next(playlistId, trackIds);
        const index = Math.max(0, state.index - 1);
        this.#save(playlistId, { order: state.order, index });
        return state.order[index];
    }
}
