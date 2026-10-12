export type SpotifyPlaybackModel = {
    playing: boolean;
    title: string;
    artist: string;
    /** The track's album art (a Spotify CDN https URL), if it has any. */
    imageUrl: string | null;
    /** URI of the album/playlist being played from, if any. */
    contextUri: string | null;
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
    /** The album/playlist being switched to, from the start of the fade-out until it's actually playing. */
    pendingContextUri: string | null;
    /**
     * The adaptive (or countdown) playlist that was last started, which switches playlist whenever the games' phase
     * changes (or for a countdown playlist, when the countdown starts or stops).
     */
    adaptivePresetId: string | null;
    /** Whether that's a countdown playlist paused for a silent spell (it starts again by itself). */
    adaptivePresetSilent: boolean;
    /** The preset to switch to at the next change of the games' phase, if one's been picked. */
    scheduledPresetId: string | null;
};

export type SpotifyControlAction =
    | { action: 'play' }
    | { action: 'pause' }
    | { action: 'next' }
    | { action: 'previous' }
    | { action: 'playContext', uri: string }
    | { action: 'playAdaptivePreset', presetId: string }
    /** Switches to the preset at the next change of the games' phase (null cancels). */
    | { action: 'schedulePreset', presetId: string | null }
    | { action: 'volume', volume: number };
