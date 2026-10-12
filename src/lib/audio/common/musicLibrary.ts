/**
 * The uploaded music library: tracks grouped into albums (which hold the artwork, once for all their tracks), and
 * playlists of tracks.
 */

export type MusicTrack = {
    id: string;
    /** Resource id of the audio file. */
    file: string;
    title: string;
    /** Empty when unknown. */
    artist: string;
    /** The album it's on, if any. */
    albumId: string | null;
    year: number | null;
    trackNumber: number | null;
    /** Length in seconds, if it could be read from the file. */
    duration: number | null;
};

export type MusicAlbum = {
    id: string;
    title: string;
    /** The album's artist, which its tracks needn't all share (e.g. a compilation). Empty when unknown. */
    artist: string;
    /** Resource id of the artwork, if it has any. */
    artwork: string | null;
};

export type MusicPlaylist = {
    id: string;
    name: string;
    /** In play order; each track at most once. */
    trackIds: string[];
};

export type MusicLibrary = {
    tracks: MusicTrack[];
    albums: MusicAlbum[];
    playlists: MusicPlaylist[];
};

/** A track's editable details. The album is by title: the track goes on that album by its artist, made if need be. */
export type MusicTrackDetails = {
    title: string;
    artist: string;
    /** Empty for no album. */
    album: string;
    year: number | null;
    trackNumber: number | null;
};

export type MusicAlbumDetails = {
    title: string;
    artist: string;
};

/** Longest text kept for any one field. */
export const MUSIC_TEXT_MAX_LENGTH = 1000;
export const MUSIC_NUMBER_MAX = 9999;

function isText(value: unknown): value is string {
    return typeof value === 'string' && value.length <= MUSIC_TEXT_MAX_LENGTH;
}

function isOptionalNumber(value: unknown): value is number | null {
    return value === null || (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MUSIC_NUMBER_MAX);
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isMusicTrack(value: unknown): value is MusicTrack {
    if (!isObject(value)) return false;
    return typeof value.id === 'string' && typeof value.file === 'string' && isText(value.title) && isText(value.artist) &&
        (value.albumId === null || typeof value.albumId === 'string') && isOptionalNumber(value.year) &&
        isOptionalNumber(value.trackNumber) && (value.duration === null || (typeof value.duration === 'number' && value.duration >= 0));
}

export function isMusicAlbum(value: unknown): value is MusicAlbum {
    if (!isObject(value)) return false;
    return typeof value.id === 'string' && isText(value.title) && isText(value.artist) &&
        (value.artwork === null || typeof value.artwork === 'string');
}

export function isMusicPlaylist(value: unknown): value is MusicPlaylist {
    if (!isObject(value)) return false;
    return typeof value.id === 'string' && isText(value.name) &&
        Array.isArray(value.trackIds) && value.trackIds.every(id => typeof id === 'string');
}

export function isMusicTrackDetails(value: unknown): value is MusicTrackDetails {
    if (!isObject(value)) return false;
    return isText(value.title) && isText(value.artist) && isText(value.album) && isOptionalNumber(value.year) && isOptionalNumber(value.trackNumber);
}

export function isMusicAlbumDetails(value: unknown): value is MusicAlbumDetails {
    if (!isObject(value)) return false;
    return isText(value.title) && isText(value.artist);
}

/** For matching artists and album titles: the same words, whatever their case or spacing. */
export function musicNameKey(name: string): string {
    return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** "3:07", or "1:02:03" for an hour or more. */
export function formatMusicDuration(seconds: number | null): string {
    if (seconds === null) return '-:--';
    const s = Math.round(seconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = (s % 60).toString().padStart(2, '0');
    return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
