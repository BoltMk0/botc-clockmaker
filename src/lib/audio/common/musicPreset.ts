import { TIMES_OF_DAY, type TimeOfDay } from "$lib/model/client/types";

/**
 * Presets for the uploaded music library, the same two kinds as the Spotify presets but playing the library's
 * playlists (always shuffled) - see spotifyPreset.ts for how each kind behaves.
 */

/** Plays a single playlist. */
export type MusicSinglePreset = {
    id: string;
    name: string;
    playlistId: string;
};

/**
 * Follows the games' phase, playing that phase's playlist. A phase with none is silent, picking up again when a phase
 * with one comes.
 */
export type MusicAdaptivePreset = {
    id: string;
    name: string;
    phasePlaylistIds: Record<TimeOfDay, string | null>;
};

export type MusicPreset = MusicSinglePreset | MusicAdaptivePreset;

export function isMusicAdaptivePreset(preset: MusicPreset): preset is MusicAdaptivePreset {
    return 'phasePlaylistIds' in preset;
}

/** Each phase a playlist id or null, and at least one not null. */
function isPhasePlaylistIds(value: unknown): boolean {
    if (typeof value !== 'object' || value === null) return false;
    const ids = value as Record<string, unknown>;
    return TIMES_OF_DAY.every(t => ids[t] === null || typeof ids[t] === 'string') && TIMES_OF_DAY.some(t => ids[t] !== null);
}

export function isMusicPreset(value: unknown): value is MusicPreset {
    if (typeof value !== 'object' || value === null) return false;
    const preset = value as Record<string, unknown>;
    if (typeof preset.id !== 'string' || typeof preset.name !== 'string') return false;
    if ('phasePlaylistIds' in preset) return isPhasePlaylistIds(preset.phasePlaylistIds);
    return typeof preset.playlistId === 'string';
}

/**
 * Upgrades, in place, a saved preset from an older kind of preset:
 * - an adaptive preset from before the morning phase, when a phase with no playlist carried on with whatever was
 *   playing: morning gets the day's playlist, as the day used to cover it, and each phase with none the one that would
 *   have carried on into it, so it doesn't go silent there now;
 * - a day & night preset (`countdownPlaylistIds`), which played its day playlist only while the countdown ran: an
 *   adaptive one with the same day and night playlists, silent in the morning and at dusk as it was.
 */
export function migrateLegacyMusicPreset(data: any) {
    if (typeof data !== 'object' || data === null) return;
    const ids = data.phasePlaylistIds;
    if (typeof ids === 'object' && ids !== null && ids.morning === undefined) {
        ids.morning = ids.day ?? null;
        const filled: Record<string, unknown> = {};
        for (let i = 0; i < TIMES_OF_DAY.length; i++) {
            // Back round the phases to the last one with a playlist
            for (let back = 0; back < TIMES_OF_DAY.length; back++) {
                const id = ids[TIMES_OF_DAY[(i - back + TIMES_OF_DAY.length) % TIMES_OF_DAY.length]];
                if (id !== null && id !== undefined) { filled[TIMES_OF_DAY[i]] = id; break; }
            }
            filled[TIMES_OF_DAY[i]] ??= null;
        }
        data.phasePlaylistIds = filled;
    }
    if (typeof data.countdownPlaylistIds === 'object' && data.countdownPlaylistIds !== null) {
        const countdown = data.countdownPlaylistIds;
        data.phasePlaylistIds = { morning: null, day: countdown.day ?? null, dusk: null, night: countdown.night ?? null };
        delete data.countdownPlaylistIds;
    }
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
    return preset.playlistId === playlistId ? null : preset;
}
