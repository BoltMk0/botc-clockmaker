import { FADER_MAX_DB, FADER_MIN_DB } from "$lib/audio/client/components/util";
import type { MusicPlayer } from "$lib/audio/client/MusicPlayer.svelte";
import type { SpotifyPlayer } from "$lib/audio/client/SpotifyPlayer.svelte";
import type { MusicLibrary } from "$lib/audio/common/musicLibrary";
import { isMusicAdaptivePreset, type MusicPreset } from "$lib/audio/common/musicPreset";
import type { SpotifyTrackItem } from "$lib/audio/common/model/spotifyModel";
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

/** A track the preset waiting for the next phase can start with. */
export type StartTrack = {
    id: string;
    title: string;
    artist: string;
    imageUrl: string | null;
};

/** One of the waiting preset's playlists, with its tracks to pick one to start with. */
export type StartTrackList = {
    key: string;
    name: string;
    /**
     * For an adaptive preset, the phases it plays this list in: a track picked from it is only started with if the
     * phase it switches at is one of them. Null for a preset with just the one list.
     */
    phases: TimeOfDay[] | null;
    tracks: StartTrack[];
    /** Why its tracks couldn't be listed. */
    error: string | null;
};

/** The track picked for the waiting preset to start with. */
export type ScheduledStart = {
    listKey: string;
    trackId: string;
    title: string;
    artist: string;
    /** As StartTrackList.phases. */
    phases: TimeOfDay[] | null;
};

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

    /** The preset waiting for the next phase, if any (only ever one, on one player or the other). */
    get #scheduled(): { source: 'music', preset: MusicPreset } | { source: 'spotify', preset: SpotifyPreset } | null {
        const { music, spotify } = this.#presets();
        const musicPreset = music.find(p => p.id === this.#music.model?.scheduledPresetId);
        if (musicPreset && this.musicAvailable) return { source: 'music', preset: musicPreset };
        const spotifyPreset = spotify.find(p => p.id === this.#spotify.model?.scheduledPresetId);
        if (spotifyPreset && this.spotifyAvailable) return { source: 'spotify', preset: spotifyPreset };
        return null;
    }

    /** The waiting preset's lists (each once), with the phases each plays in for an adaptive one. */
    #scheduledLists(): { key: string, id: string, phases: TimeOfDay[] | null }[] {
        const scheduled = this.#scheduled;
        if (!scheduled) return [];
        const lists = scheduled.source === 'music'
            ? (isMusicAdaptivePreset(scheduled.preset) ? scheduled.preset.phasePlaylistIds : scheduled.preset.playlistId)
            : (isSpotifyAdaptivePreset(scheduled.preset) ? scheduled.preset.phaseUris : scheduled.preset.uri);
        if (typeof lists === 'string') return [{ key: `${scheduled.source}:${lists}`, id: lists, phases: null }];
        const byList: { key: string, id: string, phases: TimeOfDay[] }[] = [];
        for (const phase of TIMES_OF_DAY) {
            const id = lists[phase];
            if (id === null) continue;
            const list = byList.find(l => l.id === id);
            if (list) list.phases.push(phase);
            else byList.push({ key: `${scheduled.source}:${id}`, id, phases: [phase] });
        }
        return byList;
    }

    /** The track picked for the waiting preset to start with, if one has been. */
    readonly scheduledStart: ScheduledStart | null = $derived.by(() => {
        const scheduled = this.#scheduled;
        if (!scheduled) return null;
        const start = scheduled.source === 'music' ? this.#music.model?.scheduledStartTrack : this.#spotify.model?.scheduledStartTrack;
        if (!start) return null;
        const id = 'playlistId' in start ? start.playlistId : start.contextUri;
        return {
            listKey: `${scheduled.source}:${id}`,
            trackId: 'trackId' in start ? start.trackId : start.uri,
            title: start.title,
            artist: start.artist,
            phases: this.#scheduledLists().find(l => l.id === id)?.phases ?? null
        };
    });

    /** Whether a preset's waiting for the next phase, so can be given a track to start with. */
    get canPickStart() { return this.#scheduled !== null; }

    /** Lists the waiting preset's playlists' tracks, to pick one to start with. */
    async loadStartTrackLists(): Promise<StartTrackList[]> {
        const scheduled = this.#scheduled;
        const lists = this.#scheduledLists();
        if (!scheduled) return [];
        const message = (e: unknown) => e instanceof Error ? e.message : String(e);
        if (scheduled.source === 'music') {
            let library: MusicLibrary;
            try {
                library = await fetchJson<MusicLibrary>('/api/music');
            } catch (e) {
                return lists.map(l => ({ key: l.key, name: 'Playlist', phases: l.phases, tracks: [], error: message(e) }));
            }
            const tracks = new Map(library.tracks.map(t => [t.id, t]));
            const albums = new Map(library.albums.map(a => [a.id, a]));
            return lists.map((l): StartTrackList => {
                const playlist = library.playlists.find(p => p.id === l.id);
                if (!playlist) return { key: l.key, name: 'Playlist', phases: l.phases, tracks: [], error: 'This playlist has been deleted' };
                return {
                    key: l.key,
                    name: playlist.name,
                    phases: l.phases,
                    tracks: playlist.trackIds.flatMap(id => {
                        const track = tracks.get(id);
                        if (!track) return [];
                        const artwork = track.albumId === null ? null : albums.get(track.albumId)?.artwork ?? null;
                        return [{ id, title: track.title, artist: track.artist, imageUrl: artwork ? `/api/resources/${artwork}` : null }];
                    }),
                    error: null
                };
            });
        }
        return await Promise.all(lists.map(async (l): Promise<StartTrackList> => {
            try {
                const { name, tracks } = await fetchJson<{ name: string, tracks: SpotifyTrackItem[] }>(`/api/spotify/tracks?uri=${encodeURIComponent(l.id)}`);
                return { key: l.key, name, phases: l.phases, tracks: tracks.map(t => ({ id: t.uri, title: t.title, artist: t.artist, imageUrl: t.imageUrl })), error: null };
            } catch (e) {
                return { key: l.key, name: l.id.startsWith('spotify:album:') ? 'Album' : 'Playlist', phases: l.phases, tracks: [], error: message(e) };
            }
        }));
    }

    /** Has the waiting preset start with a track of one of its lists (as StartTrackList.key), or null to just shuffle. */
    pickStartTrack(start: { listKey: string, trackId: string } | null) {
        const scheduled = this.#scheduled;
        if (!scheduled) return;
        const list = start ? this.#scheduledLists().find(l => l.key === start.listKey) : null;
        if (start && !list) return;
        const pick = start && list ? { listId: list.id, trackId: start.trackId } : null;
        if (scheduled.source === 'music') this.#music.scheduleStartTrack(pick && { playlistId: pick.listId, trackId: pick.trackId });
        else this.#spotify.scheduleStartTrack(pick && { contextUri: pick.listId, uri: pick.trackId });
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
