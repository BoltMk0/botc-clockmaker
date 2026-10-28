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
    /** Its integrated loudness in LUFS, if it's been measured (see MusicTrack.loudness). */
    loudness: number | null;
};

/** Loudness levelling: each uploaded track is turned up or down so it plays at about the same loudness as the rest. */
export type MusicLevellingModel = {
    enabled: boolean;
    /** The loudness every track is brought to, in LUFS. */
    targetLufs: number;
};

/** Crossfading: a track that ends is overlapped with the next one from its playlist, rather than played back to back. */
export type MusicCrossfadeModel = {
    enabled: boolean;
    /** How long the two overlap. */
    seconds: number;
};

export const DEFAULT_MUSIC_CROSSFADE: MusicCrossfadeModel = { enabled: false, seconds: 6 };
export const MIN_CROSSFADE_SECONDS = 1;
export const MAX_CROSSFADE_SECONDS = 30;

export function clampCrossfadeSeconds(seconds: number): number {
    return Math.round(Math.min(MAX_CROSSFADE_SECONDS, Math.max(MIN_CROSSFADE_SECONDS, seconds)) * 10) / 10;
}

export const DEFAULT_MUSIC_LEVELLING: MusicLevellingModel = { enabled: false, targetLufs: -24 };
export const MIN_LEVELLING_TARGET_LUFS = -40;
export const MAX_LEVELLING_TARGET_LUFS = -10;
/** The most a quiet track is turned up, so a near-silent one isn't blown up into its noise floor. */
export const MAX_LEVELLING_BOOST_DB = 12;

export function clampLevellingTarget(lufs: number): number {
    return Math.round(Math.min(MAX_LEVELLING_TARGET_LUFS, Math.max(MIN_LEVELLING_TARGET_LUFS, lufs)));
}

/** The hidden gain (dB) levelling applies to a track of this loudness: none while it's off, or the track's unmeasured. */
export function levellingGainDb(levelling: MusicLevellingModel, loudness: number | null | undefined): number {
    if (!levelling.enabled || loudness === null || loudness === undefined) return 0;
    return Math.min(MAX_LEVELLING_BOOST_DB, levelling.targetLufs - loudness);
}

/** The hidden gain (dB) the host applies to the loaded track. */
export function musicLevellingGainDb(model: Pick<MusicModel, 'levelling' | 'track'>): number {
    return levellingGainDb(model.levelling, model.track?.loudness);
}

/**
 * Server-wide state of the uploaded-music player, shared by every mixer client. The server decides what plays; the
 * host client (the one device the sound comes out of) follows it: whenever `loadId` changes it fades out what it had
 * (over `fadeMs`, if it was playing) and starts `track` from the top, and otherwise it plays or pauses (fading in or
 * out over `fadeMs`) to match `playing`. A change marked `crossfading` instead overlaps the two tracks over `fadeMs`.
 */
export type MusicModel = {
    /** The mixer client running the player, if any. */
    hostClientId: string | null;
    /** The strip's fader, as a linear gain (0..MAX_MUSIC_GAIN). */
    gain: number;
    track: MusicTrackPlaybackModel | null;
    /** Bumped for every track started, so starting the same track again (a one-track playlist) still restarts it. */
    loadId: number;
    playing: boolean;
    /** How long the host should fade for to make the latest change: out, or in to resume (0 for a track that just ended). */
    fadeMs: number;
    /** Whether the latest change of track is a crossfade into the playlist's next track (over fadeMs), not a fade-out. */
    crossfading: boolean;
    /** The preset playing (or paused), if any. */
    presetId: string | null;
    /** The preset being switched to, while the old one fades out. */
    pendingPresetId: string | null;
    /** Whether that's an adaptive preset paused for a silent spell (it starts again by itself). */
    presetSilent: boolean;
    /** The preset to switch to at the next change of the games' phase, if one's been picked. */
    scheduledPresetId: string | null;
    /**
     * The tracks still to play this round on each playlist of the preset loaded and the one scheduled, by playlist id,
     * in the order they will: the first is next on the playlist playing, or the one a playlist starts on when switched
     * to.
     */
    upcoming: Record<string, string[]>;
    /** Whether the Spotify player has taken over since this last started something, so what's loaded here isn't the selected preset. */
    handedOver: boolean;
    levelling: MusicLevellingModel;
    crossfade: MusicCrossfadeModel;
};

export type MusicControlAction =
    | { action: 'play' }
    | { action: 'pause' }
    | { action: 'next' }
    | { action: 'previous' }
    | { action: 'playPreset', presetId: string }
    /** Switches to the preset at the next change of the games' phase (null cancels). */
    | { action: 'schedulePreset', presetId: string | null }
    /** Moves a track to a place in what's coming up on one of those playlists (0: play next), as MusicModel.upcoming. */
    | { action: 'moveTrack', playlistId: string, trackId: string, to: number }
    | { action: 'gain', gain: number };

/** The strip's fader tops out at +12 dB, as the ambience tracks' do. */
export const MAX_MUSIC_GAIN = Math.pow(10, 12 / 20);
/** -6 dB. */
export const DEFAULT_MUSIC_GAIN = 0.5;

/**
 * What the host reports about the track it's playing: that it ended, wouldn't play, or (with crossfading on) is
 * close enough to its end for the next track to start crossfading in.
 */
export type MusicHostEvent = 'ended' | 'error' | 'crossfade';
export const MUSIC_HOST_EVENTS: readonly MusicHostEvent[] = ['ended', 'error', 'crossfade'];
