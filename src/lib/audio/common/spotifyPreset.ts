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
 * changes. A phase may have none, in which case it's silent through it, picking up again when a phase with one comes -
 * so with only day and night lists, it plays just while the countdown runs and at night.
 */
export type SpotifyAdaptivePreset = {
    id: string;
    name: string;
    phaseUris: Record<TimeOfDay, string | null>;
};

export type SpotifyPreset = SpotifySinglePreset | SpotifyAdaptivePreset;

const CONTEXT_URI_REGEX = /^spotify:(album|playlist):[A-Za-z0-9]+$/;

export function isSpotifyContextUri(value: unknown): value is string {
    return typeof value === 'string' && CONTEXT_URI_REGEX.test(value);
}

export function isSpotifyAdaptivePreset(preset: SpotifyPreset): preset is SpotifyAdaptivePreset {
    return 'phaseUris' in preset;
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
    return isSpotifyContextUri(preset.uri);
}

/**
 * Upgrades, in place, a saved preset from an older kind of preset:
 * - an adaptive playlist from when they only had day and night lists (`dayUri`/`nightUri`): dusk gets the night list,
 *   so it still switches when the timer runs out, as it did before dusk;
 * - an adaptive playlist from before the morning phase: morning gets the day list, as the day used to cover it;
 * - a day & night playlist (`countdownUris`), which played its day list only while the countdown ran: an adaptive one
 *   with the same day and night lists, silent in the morning and at dusk as it was.
 */
export function migrateLegacySpotifyPreset(data: any) {
    if (typeof data !== 'object' || data === null) return;
    if ('dayUri' in data) {
        data.phaseUris = { day: data.dayUri ?? null, dusk: data.nightUri ?? null, night: data.nightUri ?? null };
        delete data.dayUri;
        delete data.nightUri;
    }
    if (typeof data.phaseUris === 'object' && data.phaseUris !== null && data.phaseUris.morning === undefined) {
        data.phaseUris.morning = data.phaseUris.day ?? null;
    }
    if (typeof data.countdownUris === 'object' && data.countdownUris !== null) {
        data.phaseUris = { morning: null, day: data.countdownUris.day ?? null, dusk: null, night: data.countdownUris.night ?? null };
        delete data.countdownUris;
    }
}

/** Whether `uri` is one of an adaptive playlist's lists. */
export function isAdaptivePresetContext(preset: SpotifyAdaptivePreset, uri: string | null | undefined): boolean {
    return TIMES_OF_DAY.some(t => isSameSpotifyContext(uri, preset.phaseUris[t]));
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
