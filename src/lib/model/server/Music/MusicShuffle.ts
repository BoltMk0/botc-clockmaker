import { JSONSingletonResourceManager } from "$lib/resources/server/jsonResourceManager";

/** A playlist's shuffled running order, and how far through it playback has got. */
type ShuffleState = {
    order: string[];
    /** Index in `order` of the track last started (-1 before the first). */
    index: number;
};

function isShuffleStates(data: unknown): data is Record<string, ShuffleState> {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return false;
    return Object.values(data).every(s => typeof s === 'object' && s !== null && Array.isArray(s.order) &&
        s.order.every((id: unknown) => typeof id === 'string') && Number.isInteger(s.index));
}

/** Kept on disk, so a restart doesn't start every playlist's shuffle over. */
const SHUFFLE_MANAGER = new JSONSingletonResourceManager<Record<string, ShuffleState>>('music_shuffle', isShuffleStates);

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
 * tracks not yet heard rather than repeating ones that were. Once every track has played it's reshuffled (never
 * starting the new round with the track that ended the last).
 */
export class MusicShuffle {
    #states(): Record<string, ShuffleState> {
        return SHUFFLE_MANAGER.value ?? {};
    }

    #save(playlistId: string, state: ShuffleState) {
        SHUFFLE_MANAGER.save({ ...this.#states(), [playlistId]: state });
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
        return { order, index };
    }

    /** Moves on to the playlist's next track and returns it (null if the playlist is empty). */
    next(playlistId: string, trackIds: string[]): string | null {
        if (trackIds.length === 0) return null;
        const state = this.#current(playlistId, trackIds);
        let { order, index } = state;
        index++;
        if (index >= order.length) {
            const last = order[order.length - 1];
            order = shuffled(trackIds);
            if (order.length > 1 && order[0] === last) {
                const swap = 1 + Math.floor(Math.random() * (order.length - 1));
                [order[0], order[swap]] = [order[swap], order[0]];
            }
            index = 0;
        }
        this.#save(playlistId, { order, index });
        return order[index];
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
