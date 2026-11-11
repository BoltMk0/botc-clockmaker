/** How far a music player's host is through the track it's playing, as it last reported. */
export type PlaybackProgressReport = {
    positionMs: number;
    /** 0 while the track's length isn't known yet. */
    durationMs: number;
    /** Moving on (playing, not paused or waiting for data). */
    running: boolean;
};

/** A host's report as every client gets it: stamped with the server's time it came in, to count on from. */
export type PlaybackProgressModel = PlaybackProgressReport & {
    /** The server's clock (ms since the epoch) when the position was right. */
    at: number;
};

/** Where the track is up to at `serverNow` (the server's clock), counting on from the report while it's running. */
export function progressPositionMs(progress: PlaybackProgressModel, serverNow: number): number {
    const position = progress.running ? progress.positionMs + Math.max(0, serverNow - progress.at) : progress.positionMs;
    return progress.durationMs > 0 ? Math.min(progress.durationMs, position) : position;
}

/** A host's report from a request body, if it's a valid one (undefined if there isn't one, null if it's invalid). */
export function parseProgressReport(value: unknown): PlaybackProgressReport | null | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== 'object' || value === null) return null;
    const { positionMs, durationMs, running } = value as Record<string, unknown>;
    if (typeof positionMs !== 'number' || !isFinite(positionMs) || positionMs < 0) return null;
    if (typeof durationMs !== 'number' || !isFinite(durationMs) || durationMs < 0) return null;
    if (typeof running !== 'boolean') return null;
    return { positionMs, durationMs, running };
}

/** Whether a report moves things on enough to tell every client: started or stopped, a new length, or a jump (a seek, or drift). */
export function progressChanged(before: PlaybackProgressModel | null, after: PlaybackProgressModel): boolean {
    if (!before) return true;
    if (before.running !== after.running || before.durationMs !== after.durationMs) return true;
    return Math.abs(progressPositionMs(before, after.at) - after.positionMs) > PROGRESS_DRIFT_MS;
}

/** How far the position clients count on to can wander from the host's before they're told again. */
const PROGRESS_DRIFT_MS = 1000;
