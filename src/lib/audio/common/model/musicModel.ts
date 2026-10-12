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
 * (over `fadeMs`, if it was playing) and starts `track` from the top, and otherwise it plays or pauses (fading out over
 * `fadeMs` to pause) to match `playing`.
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
    levelling: MusicLevellingModel;
};

export type MusicControlAction =
    | { action: 'play' }
    | { action: 'pause' }
    | { action: 'next' }
    | { action: 'previous' }
    | { action: 'playPreset', presetId: string }
    /** Switches to the preset at the next change of the games' phase (null cancels). */
    | { action: 'schedulePreset', presetId: string | null }
    | { action: 'gain', gain: number };

/** The strip's fader tops out at +12 dB, as the ambience tracks' do. */
export const MAX_MUSIC_GAIN = Math.pow(10, 12 / 20);
/** -6 dB. */
export const DEFAULT_MUSIC_GAIN = 0.5;

/** What the host reports about the track it's playing. */
export type MusicHostEvent = 'ended' | 'error';
