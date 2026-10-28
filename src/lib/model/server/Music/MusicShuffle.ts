import { JSONSingletonResourceManager } from "$lib/resources/server/jsonResourceManager";
import { getMusicPlaylist } from "$lib/resources/server/musicLibrary";

/** A playlist's running order: what's still to play this round, and what it's played. */
type QueueState = {
    /** The tracks still to play this round, in order (each of the playlist's tracks is here, in `played` or `heard`). */
    upcoming: string[];
    /** The tracks it's started this round, oldest first, the last the one it's on (carried into the next round). */
    played: string[];
    /** Tracks of its round heard on other playlists since, so left till the next. */
    heard: string[];
    /** Tracks in `upcoming` put where they are by hand, so left there rather than put off for being heard recently. */
    placed: string[];
};

function isTrackIds(data: unknown): data is string[] {
    return Array.isArray(data) && data.every(id => typeof id === 'string');
}

/** As saved: from before `heard`, a state has none. */
type SavedQueueState = Omit<QueueState, 'heard'> & { heard?: string[] };

function isQueueStates(data: unknown): data is Record<string, SavedQueueState> {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return false;
    return Object.values(data).every(s => typeof s === 'object' && s !== null && isTrackIds(s.upcoming) &&
        isTrackIds(s.played) && (s.heard === undefined || isTrackIds(s.heard)) && isTrackIds(s.placed));
}

/** Kept on disk, so a restart doesn't start every playlist's shuffle over. */
const QUEUE_MANAGER = new JSONSingletonResourceManager<Record<string, SavedQueueState>>('music_queue', isQueueStates);
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

function trackIdsOf(playlistId: string): string[] {
    return getMusicPlaylist(playlistId)?.trackIds ?? [];
}

/**
 * Each playlist plays in a shuffled order worked out ahead of time, so what's coming up can be shown and rearranged
 * by hand, and that it remembers its place in, so switching away and back carries on with tracks not yet heard rather
 * than repeating ones that were. Once every track has played it's reshuffled.
 *
 * Playlists share tracks, so changing preset doesn't repeat what was just heard: a track played on one counts as
 * heard this round on the rest, and a new round keeps the tracks heard lately (on any playlist) spaced out from then.
 * Tracks placed by hand stay where they were put.
 */
export class MusicShuffle {
    #states(): Record<string, SavedQueueState> {
        return QUEUE_MANAGER.value ?? {};
    }

    #save(playlistId: string, state: QueueState) {
        QUEUE_MANAGER.save({ ...this.#states(), [playlistId]: state });
    }

    /**
     * A new round's tracks spaced out from when they were last heard (on any playlist): each is kept at least so many
     * tracks from then - 20, or two thirds of the playlist's tracks if that's fewer, so a short playlist still has some
     * shuffle to it rather than settling into the same order every round. Each place goes to the first track, in the
     * order they're in, that's been long enough, or if none has the one nearest to.
     */
    #arranged(order: string[], trackIds: string[]): string[] {
        const recent = RECENT_MANAGER.value ?? [];
        const gap = Math.min(RECENT_TRACKS, Math.max(2, Math.ceil(trackIds.length * 2 / 3)));
        /** The earliest place each can go: tracks ago it was heard (1 for the last), taken off the gap. */
        const earliest = (id: string) => {
            const at = recent.lastIndexOf(id);
            return at < 0 ? 0 : gap - (recent.length - at);
        };
        const free = [...order];
        return order.map((_, place) => {
            let pick = free.findIndex(f => earliest(f) <= place);
            if (pick < 0) pick = free.reduce((best, f, i) => earliest(f) < earliest(free[best]) ? i : best, 0);
            return free.splice(pick, 1)[0];
        });
    }

    /**
     * The playlist's state brought up to date with its tracks: ones taken off it are dropped, ones added since are
     * slotted in at random among those still to play, and a round that's finished is followed by a new one. Saved if
     * that changed it, so what's shown as coming up is what plays.
     */
    #current(playlistId: string): QueueState {
        const trackIds = trackIdsOf(playlistId);
        const saved = this.#states()[playlistId] ?? { upcoming: [], played: [], heard: [], placed: [] };
        const valid = new Set(trackIds);
        const upcoming = saved.upcoming.filter(id => valid.has(id));
        let played = saved.played.filter(id => valid.has(id));
        let heard = (saved.heard ?? []).filter(id => valid.has(id));
        const placed = saved.placed.filter(id => upcoming.includes(id));
        let changed = upcoming.length !== saved.upcoming.length || played.length !== saved.played.length ||
            heard.length !== (saved.heard ?? []).length || placed.length !== saved.placed.length;
        if (upcoming.length === 0 && trackIds.length > 0) {
            // Keeping the one it's on, to go back to
            upcoming.push(...this.#arranged(shuffled(trackIds), trackIds));
            played = played.slice(-1);
            heard = [];
            changed = true;
        } else {
            const known = new Set([...upcoming, ...played, ...heard]);
            for (const id of shuffled(trackIds.filter(id => !known.has(id)))) {
                upcoming.splice(Math.floor(Math.random() * (upcoming.length + 1)), 0, id);
                changed = true;
            }
        }
        const state = { upcoming, played, heard, placed };
        if (changed) this.#save(playlistId, state);
        return state;
    }

    /**
     * Where the playlist is up to: the track it last started, those still to play this round, in order, and those it's
     * played this round before that (or that were heard on other playlists), the latest first.
     */
    queue(playlistId: string): { lastPlayed: string | null, upcoming: string[], played: string[] } {
        const { played, heard, upcoming } = this.#current(playlistId);
        const earlier = [...played.slice(0, -1).reverse(), ...[...heard].reverse()].filter(id => !upcoming.includes(id));
        return { lastPlayed: played.at(-1) ?? null, upcoming, played: earlier };
    }

    /** Moves on to the playlist's next track and returns it (null if the playlist is empty). */
    next(playlistId: string): string | null {
        const { upcoming, played, heard, placed } = this.#current(playlistId);
        const trackId = upcoming.shift();
        if (trackId === undefined) return null;
        this.#save(playlistId, { upcoming, played: [...played.filter(id => id !== trackId), trackId], heard, placed: placed.filter(id => id !== trackId) });
        return trackId;
    }

    /**
     * Steps back to the track before the one it's on (which goes back to play next), or that one again if it's the
     * first of the round; null if empty.
     */
    previous(playlistId: string): string | null {
        const { upcoming, played, heard, placed } = this.#current(playlistId);
        if (played.length === 0) return this.next(playlistId);
        if (played.length > 1) {
            const current = played.pop()!;
            const back = played[played.length - 1];
            const rest = upcoming.filter(id => id !== current && id !== back);
            this.#save(playlistId, { upcoming: [current, ...rest], played, heard, placed: [current, ...placed.filter(id => id !== back)] });
            return back;
        }
        return played[0];
    }

    /**
     * Moves one of the playlist's upcoming tracks (or one that's played this round, back into the round) to the place
     * `to` in what's coming up - 0 to play next. Does nothing if it's not on the playlist.
     */
    move(playlistId: string, trackId: string, to: number) {
        if (!trackIdsOf(playlistId).includes(trackId)) return;
        const { upcoming, played, heard, placed } = this.#current(playlistId);
        const rest = upcoming.filter(id => id !== trackId);
        rest.splice(Math.max(0, Math.min(rest.length, Math.floor(to))), 0, trackId);
        // Back in the round, so not counted as played (unless it's the one it's on, to go back from)
        const stillPlayed = played.filter((id, i) => id !== trackId || i === played.length - 1);
        this.#save(playlistId, { upcoming: rest, played: stillPlayed, heard: heard.filter(id => id !== trackId), placed: [...placed.filter(id => id !== trackId), trackId] });
    }

    /**
     * Notes a track's been started, whichever way it was picked, leaving it till the next round on every other playlist
     * it's coming up on (unless it was placed there by hand).
     */
    played(trackId: string) {
        const recent = (RECENT_MANAGER.value ?? []).filter(id => id !== trackId);
        recent.push(trackId);
        RECENT_MANAGER.save(recent.slice(-RECENT_TRACKS));
        for (const [playlistId, saved] of Object.entries(this.#states())) {
            if (!saved.upcoming.includes(trackId) || saved.placed.includes(trackId)) continue;
            const state = this.#current(playlistId);
            this.#save(playlistId, { ...state, upcoming: state.upcoming.filter(id => id !== trackId), heard: [...state.heard, trackId] });
        }
    }
}
