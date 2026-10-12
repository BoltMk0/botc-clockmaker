/** The track the music player has loaded, as every client shows it. */
export type MusicTrackPlaybackModel = {
    trackId: string;
    /** The playlist it's playing from. */
    playlistId: string;
    title: string;
    artist: string;
    album: string;
    /** The album's artwork, if it has any. */
    imageUrl: string | null;
    /** The audio file. */
    url: string;
};

/**
 * Server-wide state of the uploaded-music player, shared by every mixer client. The server decides what plays; the
 * host client (the one device the sound comes out of) follows it: whenever `loadId` changes it fades out what it had
 * (over `fadeMs`, if it was playing) and starts `track` from the top, and otherwise it plays or pauses (fading out over
 * `fadeMs` to pause) to match `playing`.
 */
export type MusicModel = {
    /** The mixer client running the player, if any. */
    hostClientId: string | null;
    /** Volume 0..100. */
    volume: number;
    track: MusicTrackPlaybackModel | null;
    /** Bumped for every track started, so starting the same track again (a one-track playlist) still restarts it. */
    loadId: number;
    playing: boolean;
    /** How long the host should fade out for to make the latest change (0 for a track that just ended). */
    fadeMs: number;
    /** The preset playing (or paused), if any. */
    presetId: string | null;
    /** The preset being switched to, while the old one fades out. */
    pendingPresetId: string | null;
    /** Whether that's a day & night preset paused for a silent spell (it starts again by itself). */
    presetSilent: boolean;
    /** The preset to switch to at the next change of the games' phase, if one's been picked. */
    scheduledPresetId: string | null;
};

export type MusicControlAction =
    | { action: 'play' }
    | { action: 'pause' }
    | { action: 'next' }
    | { action: 'previous' }
    | { action: 'playPreset', presetId: string }
    /** Switches to the preset at the next change of the games' phase (null cancels). */
    | { action: 'schedulePreset', presetId: string | null }
    | { action: 'volume', volume: number };

/** What the host reports about the track it's playing. */
export type MusicHostEvent = 'ended' | 'error';
