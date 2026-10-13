import { FADER_MAX_DB, FADER_MIN_DB } from "$lib/audio/client/components/util";
import type { MusicPlayer } from "$lib/audio/client/MusicPlayer.svelte";
import type { SpotifyPlayer } from "$lib/audio/client/SpotifyPlayer.svelte";
import { isMusicAdaptivePreset, type MusicPreset } from "$lib/audio/common/musicPreset";
import { isSpotifyAdaptivePreset, spotifyPresetMatches, type SpotifyPreset } from "$lib/audio/common/spotifyPreset";

export type MusicSource = 'music' | 'spotify';

/** A music or Spotify preset, as the remote's single list of them shows it. */
export type RemotePreset = {
    key: string;
    source: MusicSource;
    name: string;
    adaptive: boolean;
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

/**
 * The uploaded-music player and Spotify as one music source for the remote: whichever's playing (or has something
 * loaded) is what's shown and controlled, and their presets are one list. Both players are remote-only here, so a
 * preset can only be played while its player runs on another device.
 */
export class RemoteMusic {
    readonly #music: MusicPlayer;
    readonly #spotify: SpotifyPlayer;
    readonly #presets: () => { music: MusicPreset[], spotify: SpotifyPreset[] };

    constructor(music: MusicPlayer, spotify: SpotifyPlayer, presets: () => { music: MusicPreset[], spotify: SpotifyPreset[] }) {
        this.#music = music;
        this.#spotify = spotify;
        this.#presets = presets;
    }

    get musicAvailable() { return this.#music.active; }
    /** A Spotify player is running somewhere and can take commands. */
    get spotifyAvailable() {
        const model = this.#spotify.model;
        return !!model?.hostClientId && model.hostReady;
    }

    get #spotifyPlaying() { return this.spotifyAvailable && this.#spotify.playback?.playing === true; }
    get anyPlaying() { return this.#music.playing || this.#spotifyPlaying; }

    /** The player shown and controlled: the one playing, or else the one with something loaded. */
    readonly source: MusicSource | null = $derived.by(() => {
        if (this.#music.playing) return 'music';
        if (this.#spotifyPlaying) return 'spotify';
        if (this.musicAvailable && this.#music.track) return 'music';
        if (this.spotifyAvailable && this.#spotify.playback) return 'spotify';
        return null;
    });

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
                const current = musicModel?.presetId === preset.id;
                const playing = current && this.#music.playing;
                return {
                    key: `music:${preset.id}`,
                    source: 'music',
                    name: preset.name,
                    adaptive: isMusicAdaptivePreset(preset),
                    available: this.musicAvailable,
                    current,
                    playing,
                    pending: musicModel?.pendingPresetId === preset.id,
                    scheduled: musicModel?.scheduledPresetId === preset.id,
                    silent: current && isMusicAdaptivePreset(preset) && musicModel?.presetSilent === true,
                    // As on the mixer's strip: the loaded one plays or pauses; another waits for the phase change while
                    // anything's playing (tapped again, it switches now); with nothing playing, it starts at once
                    click: () => {
                        if (playing) this.#music.togglePlayPause();
                        else if (!current && musicModel?.scheduledPresetId !== preset.id && this.anyPlaying) this.#music.schedulePreset(preset.id);
                        else this.#music.playPreset(preset.id);
                    }
                };
            }),
            ...spotify.map((preset): RemotePreset => {
                const current = spotifyPresetMatches(preset, spotifyModel, this.#spotify.playback?.contextUri);
                const playing = current && this.#spotify.playback?.playing === true;
                return {
                    key: `spotify:${preset.id}`,
                    source: 'spotify',
                    name: preset.name,
                    adaptive: isSpotifyAdaptivePreset(preset),
                    available: this.spotifyAvailable,
                    current,
                    playing,
                    pending: spotifyPresetMatches(preset, spotifyModel, spotifyModel?.pendingContextUri),
                    scheduled: spotifyModel?.scheduledPresetId === preset.id,
                    silent: current && isSpotifyAdaptivePreset(preset) && spotifyModel?.adaptivePresetSilent === true,
                    click: () => {
                        if (playing) this.#spotify.togglePlayPause();
                        else if (!current && spotifyModel?.scheduledPresetId !== preset.id && this.anyPlaying) this.#spotify.schedulePreset(preset.id);
                        else if (isSpotifyAdaptivePreset(preset)) this.#spotify.playAdaptivePreset(preset.id);
                        else if (current) this.#spotify.togglePlayPause();
                        else this.#spotify.playContext(preset.uri);
                    }
                };
            })
        ];
    });

    get error() { return this.#music.error ?? this.#spotify.error; }

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
