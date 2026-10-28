import { FADER_MAX_DB, FADER_MIN_DB } from "$lib/audio/client/components/util";
import type { MusicPlayer } from "$lib/audio/client/MusicPlayer.svelte";
import type { SpotifyPlayer } from "$lib/audio/client/SpotifyPlayer.svelte";
import type { MusicLibrary } from "$lib/audio/common/musicLibrary";
import { isMusicAdaptivePreset, type MusicPreset } from "$lib/audio/common/musicPreset";
import { isSpotifyAdaptivePreset, spotifyPresetMatches, type SpotifyPreset } from "$lib/audio/common/spotifyPreset";
import { TIMES_OF_DAY, type TimeOfDay } from "$lib/model/client/types";

export type MusicSource = 'music' | 'spotify';

/** A music or Spotify preset, as the remote's single list of them shows it. */
export type RemotePreset = {
    key: string;
    source: MusicSource;
    name: string;
    adaptive: boolean;
    /** For an adaptive preset, whether each phase has a playlist (the rest are silent). */
    phases: Record<TimeOfDay, boolean> | null;
    /** Its player is running somewhere, so it can be played. */
    available: boolean;
    /** Loaded on its player (playing or paused). */
    current: boolean;
    playing: boolean;
    /** Being switched to, while what was playing fades out. */
    pending: boolean;
    /** Waiting for the next change of phase. */
    scheduled: boolean;
    /** An adaptive preset quiet through a phase it has nothing for. */
    silent: boolean;
    click: () => void;
};

export type NowPlaying = {
    source: MusicSource;
    playing: boolean;
    title: string;
    artist: string;
    imageUrl: string | null;
    presetName: string | null;
};

/** A track coming up on one of the music player's playlists. */
export type UpcomingTrack = {
    id: string;
    title: string;
    artist: string;
    imageUrl: string | null;
};

/** One of the playlists of the music preset loaded or the one scheduled, with what's coming up on it, in order. */
export type UpcomingList = {
    playlistId: string;
    name: string;
    /** The preset it's from (the loaded one, if both have it). */
    presetName: string;
    /** For an adaptive preset, the phases it plays the list in; null for a preset with just the one list. */
    phases: TimeOfDay[] | null;
    /** From the preset scheduled for the next phase, not the one loaded. */
    scheduled: boolean;
    /** The one playing (or paused) now, so its first track plays after the current one. */
    current: boolean;
    tracks: UpcomingTrack[];
};

/** A music preset's playlists (each once), with the phases each plays in for an adaptive one. */
function presetLists(preset: MusicPreset): { id: string, phases: TimeOfDay[] | null }[] {
    if (!isMusicAdaptivePreset(preset)) return [{ id: preset.playlistId, phases: null }];
    const lists: { id: string, phases: TimeOfDay[] }[] = [];
    for (const phase of TIMES_OF_DAY) {
        const id = preset.phasePlaylistIds[phase];
        if (id === null) continue;
        const list = lists.find(l => l.id === id);
        if (list) list.phases.push(phase);
        else lists.push({ id, phases: [phase] });
    }
    return lists;
}

/** A Spotify player is running somewhere and can take commands. */
function spotifyAvailable(spotify: SpotifyPlayer) {
    const model = spotify.model;
    return !!model?.hostClientId && model.hostReady;
}

/**
 * The selected player, whose preset is the selected one: the one the other last handed over to, even while it's quiet
 * (an adaptive preset silent for the phase, say, or one still fading the other out); or else, before either has
 * taken over, the one playing, or with a preset or something loaded. The remote shows and controls it, and the
 * mixer's strips highlight only its preset.
 */
export function selectedMusicSource(music: MusicPlayer, spotify: SpotifyPlayer): MusicSource | null {
    const spotifyReady = spotifyAvailable(spotify);
    if (music.active && !music.model?.handedOver && spotify.model?.handedOver) return 'music';
    if (spotifyReady && !spotify.model?.handedOver && music.model?.handedOver) return 'spotify';
    if (music.playing) return 'music';
    if (spotifyReady && spotify.playback?.playing) return 'spotify';
    if (music.active && (music.track || music.model?.presetId)) return 'music';
    if (spotifyReady && (spotify.playback || spotify.model?.adaptivePresetId)) return 'spotify';
    return null;
}

/**
 * The uploaded-music player and Spotify as one music source for the remote: whichever's playing (or has something
 * loaded) is what's shown and controlled, and their presets are one list. Both players are remote-only here, so a
 * preset can only be played while its player runs on another device.
 */
export class RemoteMusic {
    readonly #music: MusicPlayer;
    readonly #spotify: SpotifyPlayer;
    readonly #presets: () => { music: MusicPreset[], spotify: SpotifyPreset[] };
    /** Each source's volume when it was last muted, to restore on unmute. */
    readonly #unmuteVolumes: { music?: number, spotify?: number } = {};

    constructor(music: MusicPlayer, spotify: SpotifyPlayer, presets: () => { music: MusicPreset[], spotify: SpotifyPreset[] }) {
        this.#music = music;
        this.#spotify = spotify;
        this.#presets = presets;
    }

    get musicAvailable() { return this.#music.active; }
    /** A Spotify player is running somewhere and can take commands. */
    get spotifyAvailable() { return spotifyAvailable(this.#spotify); }

    /** The player shown and controlled (see selectedMusicSource). */
    readonly source: MusicSource | null = $derived.by(() => selectedMusicSource(this.#music, this.#spotify));

    readonly nowPlaying: NowPlaying | null = $derived.by(() => {
        const source = this.source;
        if (source === 'music') {
            const playback = this.#music.playback;
            if (!playback) return null;
            const presetId = this.#music.model?.presetId;
            const presetName = this.#presets().music.find(p => p.id === presetId)?.name ?? null;
            return { source, ...playback, presetName };
        }
        if (source === 'spotify') {
            const playback = this.#spotify.playback;
            if (!playback) return null;
            const preset = this.#presets().spotify.find(p => spotifyPresetMatches(p, this.#spotify.model, playback.contextUri));
            return { source, playing: playback.playing, title: playback.title, artist: playback.artist, imageUrl: playback.imageUrl, presetName: preset?.name ?? null };
        }
        return null;
    });

    readonly presets: RemotePreset[] = $derived.by(() => {
        const { music, spotify } = this.#presets();
        const musicModel = this.#music.model;
        const spotifyModel = this.#spotify.model;
        return [
            ...music.map((preset): RemotePreset => {
                const current = this.source === 'music' && musicModel?.presetId === preset.id;
                const playing = current && this.#music.playing;
                return {
                    key: `music:${preset.id}`,
                    source: 'music',
                    name: preset.name,
                    adaptive: isMusicAdaptivePreset(preset),
                    phases: isMusicAdaptivePreset(preset) ? phasesWith(preset.phasePlaylistIds) : null,
                    available: this.musicAvailable,
                    current,
                    playing,
                    pending: musicModel?.pendingPresetId === preset.id,
                    scheduled: musicModel?.scheduledPresetId === preset.id,
                    silent: current && isMusicAdaptivePreset(preset) && musicModel?.presetSilent === true,
                    // As on the mixer's strip: the loaded one plays or pauses; another waits for the phase change (tapped
                    // again, it switches now)
                    click: () => {
                        if (playing) this.#music.togglePlayPause();
                        else if (!current && musicModel?.scheduledPresetId !== preset.id) this.#music.schedulePreset(preset.id);
                        else this.#music.playPreset(preset.id);
                    }
                };
            }),
            ...spotify.map((preset): RemotePreset => {
                const current = this.source === 'spotify' && spotifyPresetMatches(preset, spotifyModel, this.#spotify.playback?.contextUri);
                const playing = current && this.#spotify.playback?.playing === true;
                return {
                    key: `spotify:${preset.id}`,
                    source: 'spotify',
                    name: preset.name,
                    adaptive: isSpotifyAdaptivePreset(preset),
                    phases: isSpotifyAdaptivePreset(preset) ? phasesWith(preset.phaseUris) : null,
                    available: this.spotifyAvailable,
                    current,
                    playing,
                    pending: spotifyPresetMatches(preset, spotifyModel, spotifyModel?.pendingContextUri),
                    scheduled: spotifyModel?.scheduledPresetId === preset.id,
                    silent: current && isSpotifyAdaptivePreset(preset) && spotifyModel?.adaptivePresetSilent === true,
                    click: () => {
                        if (playing) this.#spotify.togglePlayPause();
                        else if (!current && spotifyModel?.scheduledPresetId !== preset.id) this.#spotify.schedulePreset(preset.id);
                        else if (isSpotifyAdaptivePreset(preset)) this.#spotify.playAdaptivePreset(preset.id);
                        else if (current) this.#spotify.togglePlayPause();
                        else this.#spotify.playContext(preset.uri);
                    }
                };
            })
        ];
    });

    get error() { return this.#music.error ?? this.#spotify.error; }

    /** The music library, to show what's coming up with (loaded by loadLibrary). */
    #library = $state<MusicLibrary | null>(null);

    /** (Re)loads the music library, so what's coming up shows with its tracks' names. */
    async loadLibrary() {
        try {
            this.#library = await fetchJson<MusicLibrary>('/api/music');
        } catch (e) {
            console.error('Failed to load the music library', e);
        }
    }

    /**
     * What's coming up on each playlist of the music preset loaded (while it's the player selected) and the one
     * scheduled for the next phase: the one playing first, then the rest in phase order.
     */
    readonly upcomingLists: UpcomingList[] = $derived.by(() => {
        const model = this.#music.model;
        const library = this.#library;
        if (!model || !this.musicAvailable) return [];
        const { music } = this.#presets();
        const loaded = this.source === 'music' ? music.find(p => p.id === model.presetId) : undefined;
        const scheduled = music.find(p => p.id === model.scheduledPresetId);
        const tracks = new Map(library?.tracks.map(t => [t.id, t]));
        const albums = new Map(library?.albums.map(a => [a.id, a]));
        const lists: UpcomingList[] = [];
        for (const [preset, isScheduled] of [[loaded, false], [scheduled, true]] as const) {
            if (!preset) continue;
            for (const { id, phases } of presetLists(preset)) {
                const upcoming = model.upcoming[id];
                if (!upcoming || lists.some(l => l.playlistId === id)) continue;
                lists.push({
                    playlistId: id,
                    name: library?.playlists.find(p => p.id === id)?.name ?? 'Playlist',
                    presetName: preset.name,
                    phases,
                    scheduled: isScheduled,
                    current: !isScheduled && model.track?.playlistId === id,
                    tracks: upcoming.flatMap(trackId => {
                        const track = tracks.get(trackId);
                        if (!track) return library ? [] : [{ id: trackId, title: '…', artist: '', imageUrl: null }];
                        const artwork = track.albumId === null ? null : albums.get(track.albumId)?.artwork ?? null;
                        return [{ id: trackId, title: track.title, artist: track.artist, imageUrl: artwork ? `/api/resources/${artwork}` : null }];
                    })
                });
            }
        }
        return [...lists.filter(l => l.current), ...lists.filter(l => !l.current)];
    });

    /** Moves a track to a place in what's coming up on one of those playlists (0: play next). */
    moveTrack(playlistId: string, trackId: string, to: number) {
        this.#music.moveTrack(playlistId, trackId, to);
    }

    togglePlayPause() {
        if (this.source === 'music') this.#music.togglePlayPause();
        else if (this.source === 'spotify') this.#spotify.togglePlayPause();
    }

    next() {
        if (this.source === 'music') this.#music.next();
        else if (this.source === 'spotify') this.#spotify.next();
    }

    previous() {
        if (this.source === 'music') this.#music.previous();
        else if (this.source === 'spotify') this.#spotify.previous();
    }

    /** The source's volume, 0..1: the music strip's fader on its dB scale, or Spotify's own volume. */
    get volume(): number | null {
        if (this.source === 'music') return gainToFader(this.#music.model?.gain ?? null);
        if (this.source === 'spotify') return this.#spotify.model ? this.#spotify.model.volume / 100 : null;
        return null;
    }

    setVolume(volume: number) {
        if (this.source === 'music') this.#music.setGain(faderToGain(volume));
        else if (this.source === 'spotify') this.#spotify.setVolume(Math.round(volume * 100));
    }

    /** The source's volume is all the way down. */
    get muted(): boolean { return this.volume === 0; }

    /** Turn the source's volume all the way down, or back up to where it was (or to unity gain / half volume). */
    toggleMute() {
        const source = this.source;
        const volume = this.volume;
        if (source !== 'music' && source !== 'spotify' || volume === null) return;
        if (volume > 0) {
            this.#unmuteVolumes[source] = volume;
            this.setVolume(0);
        } else {
            this.setVolume(this.#unmuteVolumes[source] ?? (source === 'music' ? gainToFader(1)! : 0.5));
        }
    }
}

async function fetchJson<T>(url: string): Promise<T> {
    const res = await fetch(url);
    if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? `Request failed (${res.status})`);
    }
    return await res.json();
}

/** Which phases an adaptive preset has a playlist for. */
function phasesWith(playlists: Record<TimeOfDay, string | null>): Record<TimeOfDay, boolean> {
    return Object.fromEntries(TIMES_OF_DAY.map(t => [t, playlists[t] !== null])) as Record<TimeOfDay, boolean>;
}

// The music volume slider spans the mixer fader's range; all the way down is off.

function gainToFader(gain: number | null): number | null {
    if (gain === null) return null;
    if (gain <= 0) return 0;
    const db = 20 * Math.log10(gain);
    return Math.min(1, Math.max(0, (db - FADER_MIN_DB) / (FADER_MAX_DB - FADER_MIN_DB)));
}

function faderToGain(value: number): number {
    if (value <= 0) return 0;
    return Math.pow(10, (FADER_MIN_DB + value * (FADER_MAX_DB - FADER_MIN_DB)) / 20);
}
