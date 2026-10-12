import { TIMES_OF_DAY, type TimeOfDay } from "$lib/model/client/types";
import { COUNTDOWN_PHASES, type CountdownPhase } from "./spotifyPreset";

/**
 * Presets for the uploaded music library, the same three kinds as the Spotify presets but playing the library's
 * playlists (always shuffled) - see spotifyPreset.ts for how each kind behaves.
 */

/** Plays a single playlist. */
export type MusicSinglePreset = {
    id: string;
    name: string;
    playlistId: string;
};

/** Follows the games' phase, playing that phase's playlist. A phase with none carries on with whatever was playing. */
export type MusicAdaptivePreset = {
    id: string;
    name: string;
    phasePlaylistIds: Record<TimeOfDay, string | null>;
};

/** A day playlist that only plays while a game's countdown runs, and a night playlist; silent otherwise. */
export type MusicCountdownPreset = {
    id: string;
    name: string;
    countdownPlaylistIds: Record<CountdownPhase, string | null>;
};

export type MusicFollowingPreset = MusicAdaptivePreset | MusicCountdownPreset;
export type MusicPreset = MusicSinglePreset | MusicFollowingPreset;

export function isMusicAdaptivePreset(preset: MusicPreset): preset is MusicAdaptivePreset {
    return 'phasePlaylistIds' in preset;
}

export function isMusicCountdownPreset(preset: MusicPreset): preset is MusicCountdownPreset {
    return 'countdownPlaylistIds' in preset;
}

export function isMusicFollowingPreset(preset: MusicPreset): preset is MusicFollowingPreset {
    return isMusicAdaptivePreset(preset) || isMusicCountdownPreset(preset);
}

/** Each of `keys` a playlist id or null, and at least one not null. */
function isPlaylistIdRecord(value: unknown, keys: readonly string[]): boolean {
    if (typeof value !== 'object' || value === null) return false;
    const ids = value as Record<string, unknown>;
    return keys.every(k => ids[k] === null || typeof ids[k] === 'string') && keys.some(k => ids[k] !== null);
}

export function isMusicPreset(value: unknown): value is MusicPreset {
    if (typeof value !== 'object' || value === null) return false;
    const preset = value as Record<string, unknown>;
    if (typeof preset.id !== 'string' || typeof preset.name !== 'string') return false;
    if ('phasePlaylistIds' in preset) return isPlaylistIdRecord(preset.phasePlaylistIds, TIMES_OF_DAY);
    if ('countdownPlaylistIds' in preset) return isPlaylistIdRecord(preset.countdownPlaylistIds, COUNTDOWN_PHASES);
    return typeof preset.playlistId === 'string';
}

/** Every playlist the preset plays, in any phase. */
export function musicPresetPlaylistIds(preset: MusicPreset): string[] {
    if (isMusicAdaptivePreset(preset)) return TIMES_OF_DAY.map(t => preset.phasePlaylistIds[t]).filter((id): id is string => id !== null);
    if (isMusicCountdownPreset(preset)) return COUNTDOWN_PHASES.map(p => preset.countdownPlaylistIds[p]).filter((id): id is string => id !== null);
    return [preset.playlistId];
}

/**
 * The playlist an adaptive preset plays when started in `timeOfDay`: that phase's own, or if it has none, the one that
 * would have carried on into it from the phases before.
 */
export function adaptiveMusicPlaylistFor(preset: MusicAdaptivePreset, timeOfDay: TimeOfDay): string | null {
    const start = TIMES_OF_DAY.indexOf(timeOfDay);
    for (let i = 0; i < TIMES_OF_DAY.length; i++) {
        const id = preset.phasePlaylistIds[TIMES_OF_DAY[(start - i + TIMES_OF_DAY.length) % TIMES_OF_DAY.length]];
        if (id !== null) return id;
    }
    return null;
}

/**
 * The preset with its references to `playlistId` taken out (a deleted playlist), or null if that leaves it with
 * nothing to play.
 */
export function withoutMusicPlaylist(preset: MusicPreset, playlistId: string): MusicPreset | null {
    if (isMusicAdaptivePreset(preset)) {
        const phasePlaylistIds = Object.fromEntries(TIMES_OF_DAY.map(t => [t, preset.phasePlaylistIds[t] === playlistId ? null : preset.phasePlaylistIds[t]])) as Record<TimeOfDay, string | null>;
        return TIMES_OF_DAY.some(t => phasePlaylistIds[t] !== null) ? { ...preset, phasePlaylistIds } : null;
    }
    if (isMusicCountdownPreset(preset)) {
        const countdownPlaylistIds = Object.fromEntries(COUNTDOWN_PHASES.map(p => [p, preset.countdownPlaylistIds[p] === playlistId ? null : preset.countdownPlaylistIds[p]])) as Record<CountdownPhase, string | null>;
        return COUNTDOWN_PHASES.some(p => countdownPlaylistIds[p] !== null) ? { ...preset, countdownPlaylistIds } : null;
    }
    return preset.playlistId === playlistId ? null : preset;
}
