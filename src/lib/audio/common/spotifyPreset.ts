import { TIMES_OF_DAY, type TimeOfDay } from "$lib/model/client/types";

/** Plays a single album/playlist. */
export type SpotifySinglePreset = {
    id: string;
    name: string;
    /** Normalised context URI, e.g. spotify:playlist:37i9dQZF1DXcBWIGoYBM5M */
    uri: string;
};

/**
 * An adaptive playlist: follows the games' phase, playing that phase's album/playlist and switching over when the phase
 * changes. A phase may have none, in which case it's silent through it, picking up again when a phase with one comes.
 */
export type SpotifyAdaptivePreset = {
    id: string;
    name: string;
    phaseUris: Record<TimeOfDay, string | null>;
};

/**
 * A countdown playlist: a day list that only plays while a game's countdown is running, and a night list for the night.
 * Otherwise (the morning before the countdown is started, and dusk) it's silent, picking up again when the countdown
 * starts or night falls. Either list may be empty, leaving that time silent too.
 */
export type SpotifyCountdownPreset = {
    id: string;
    name: string;
    countdownUris: Record<CountdownPhase, string | null>;
};

/** The two times a countdown playlist plays a list in. */
export const COUNTDOWN_PHASES = ['day', 'night'] as const;
export type CountdownPhase = typeof COUNTDOWN_PHASES[number];

/** A preset that follows the games, switching (or for a countdown playlist, also going quiet) by itself. */
export type SpotifyFollowingPreset = SpotifyAdaptivePreset | SpotifyCountdownPreset;

export type SpotifyPreset = SpotifySinglePreset | SpotifyFollowingPreset;

const CONTEXT_URI_REGEX = /^spotify:(album|playlist):[A-Za-z0-9]+$/;

export function isSpotifyContextUri(value: unknown): value is string {
    return typeof value === 'string' && CONTEXT_URI_REGEX.test(value);
}

export function isSpotifyAdaptivePreset(preset: SpotifyPreset): preset is SpotifyAdaptivePreset {
    return 'phaseUris' in preset;
}

export function isSpotifyCountdownPreset(preset: SpotifyPreset): preset is SpotifyCountdownPreset {
    return 'countdownUris' in preset;
}

export function isSpotifyFollowingPreset(preset: SpotifyPreset): preset is SpotifyFollowingPreset {
    return isSpotifyAdaptivePreset(preset) || isSpotifyCountdownPreset(preset);
}

/** A countdown playlist needs a list for day or night (or both). */
function isCountdownUris(value: unknown): value is Record<CountdownPhase, string | null> {
    if (typeof value !== 'object' || value === null) return false;
    const uris = value as Record<string, unknown>;
    return COUNTDOWN_PHASES.every(p => uris[p] === null || isSpotifyContextUri(uris[p])) && COUNTDOWN_PHASES.some(p => uris[p] !== null);
}

/** An adaptive playlist needs a list for at least one phase. */
function isPhaseUris(value: unknown): value is Record<TimeOfDay, string | null> {
    if (typeof value !== 'object' || value === null) return false;
    const uris = value as Record<string, unknown>;
    return TIMES_OF_DAY.every(t => uris[t] === null || isSpotifyContextUri(uris[t])) && TIMES_OF_DAY.some(t => uris[t] !== null);
}

export function isSpotifyPreset(value: unknown): value is SpotifyPreset {
    if (typeof value !== 'object' || value === null) return false;
    const preset = value as Record<string, unknown>;
    if (typeof preset.id !== 'string' || typeof preset.name !== 'string') return false;
    if ('phaseUris' in preset) return isPhaseUris(preset.phaseUris);
    if ('countdownUris' in preset) return isCountdownUris(preset.countdownUris);
    return isSpotifyContextUri(preset.uri);
}

/**
 * Upgrades, in place, a saved preset from when adaptive playlists only had day and night lists (`dayUri`/`nightUri`).
 * Dusk gets the night list, so it still switches when the timer runs out, as it did before dusk.
 */
export function migrateLegacySpotifyPreset(data: any) {
    if (typeof data !== 'object' || data === null || !('dayUri' in data)) return;
    data.phaseUris = { day: data.dayUri ?? null, dusk: data.nightUri ?? null, night: data.nightUri ?? null };
    delete data.dayUri;
    delete data.nightUri;
}

/** Whether `uri` is one of an adaptive (or countdown) playlist's lists. */
export function isAdaptivePresetContext(preset: SpotifyFollowingPreset, uri: string | null | undefined): boolean {
    const uris = isSpotifyCountdownPreset(preset) ? COUNTDOWN_PHASES.map(p => preset.countdownUris[p]) : TIMES_OF_DAY.map(t => preset.phaseUris[t]);
    return uris.some(u => isSameSpotifyContext(uri, u));
}

/** Whether two context URIs are the same album/playlist (tolerates the old spotify:user:NAME:playlist:ID form). */
export function isSameSpotifyContext(a: string | null | undefined, b: string | null | undefined): boolean {
    if (!a || !b) return false;
    const key = (uri: string) => uri.split(':').slice(-2).join(':');
    return key(a) === key(b);
}

/**
 * Accepts a Spotify album/playlist URI (spotify:playlist:ID) or share link
 * (https://open.spotify.com/playlist/ID?si=..., including /intl-xx/ links) and returns the URI, or null if it isn't one.
 */
export function parseSpotifyContextUri(input: string): string | null {
    const text = input.trim();
    if (isSpotifyContextUri(text)) return text;
    const match = /^https?:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(album|playlist)\/([A-Za-z0-9]+)/i.exec(text);
    return match ? `spotify:${match[1].toLowerCase()}:${match[2]}` : null;
}
