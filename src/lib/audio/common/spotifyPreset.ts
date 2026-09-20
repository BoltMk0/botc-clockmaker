export type SpotifyPreset = {
    id: string;
    name: string;
    /** Normalised context URI, e.g. spotify:playlist:37i9dQZF1DXcBWIGoYBM5M */
    uri: string;
};

const CONTEXT_URI_REGEX = /^spotify:(album|playlist):[A-Za-z0-9]+$/;

export function isSpotifyContextUri(value: unknown): value is string {
    return typeof value === 'string' && CONTEXT_URI_REGEX.test(value);
}

export function isSpotifyPreset(value: unknown): value is SpotifyPreset {
    return typeof value === 'object' && value !== null &&
        typeof (value as SpotifyPreset).id === 'string' &&
        typeof (value as SpotifyPreset).name === 'string' &&
        isSpotifyContextUri((value as SpotifyPreset).uri);
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
