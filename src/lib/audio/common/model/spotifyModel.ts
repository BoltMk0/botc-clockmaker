export type SpotifyPlaybackModel = {
    playing: boolean;
    title: string;
    artist: string;
};

/** Server-wide Spotify state, shared by every mixer client. */
export type SpotifyModel = {
    /** Server has SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET. */
    configured: boolean;
    /** A Spotify account has been linked (refresh token stored). */
    authorized: boolean;
    /** The mixer client currently running the web player, if any. */
    hostClientId: string | null;
    /** Reported by the host once its player is registered with Spotify and can receive commands. */
    hostReady: boolean;
    /** Volume 0..100. */
    volume: number;
    playback: SpotifyPlaybackModel | null;
};

export type SpotifyControlAction =
    | { action: 'play' }
    | { action: 'pause' }
    | { action: 'next' }
    | { action: 'previous' }
    | { action: 'volume', volume: number };
