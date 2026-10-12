import { EventEmitter } from "node:events";
import { clampCrossfadeSeconds, clampLevellingTarget, DEFAULT_MUSIC_CROSSFADE, DEFAULT_MUSIC_GAIN, DEFAULT_MUSIC_LEVELLING, MAX_MUSIC_GAIN, type MusicCrossfadeModel, type MusicControlAction, type MusicHostEvent, type MusicLevellingModel, type MusicModel, type MusicTrackPlaybackModel } from "$lib/audio/common/model/musicModel";
import { adaptiveMusicPlaylistFor, isMusicAdaptivePreset, isMusicCountdownPreset, musicPresetPlaylistIds, type MusicAdaptivePreset, type MusicCountdownPreset, type MusicPreset } from "$lib/audio/common/musicPreset";
import type { CountdownPhase } from "$lib/audio/common/spotifyPreset";
import type { TimeOfDay } from "$lib/model/client/types";
import { getMusicAlbum, getMusicPlaylist, getMusicTrack } from "$lib/resources/server/musicLibrary";
import { getMusicPresets } from "$lib/resources/server/musicPresets";
import { musicLoudnessEvents } from "$lib/resources/server/musicLoudness";
import { JSONSingletonResourceManager } from "$lib/resources/server/jsonResourceManager";
import { getBOTCTClockInstanceManager } from "../model";
import { getSpotifyHelperInstance } from "../Spotify/SpotifyHelper";
import { MusicShuffle } from "./MusicShuffle";

/** The host reports in every few seconds; if it goes quiet for this long its claim lapses and another client may take over. */
const HOST_TIMEOUT_MS = 15000;
const HOST_CHECK_INTERVAL_MS = 5000;
/** Fade-out when a preset is picked. */
const FADE_MS = 1200;
/** Fade-out when a preset follows the games' phase - longer, as it's not something the user just clicked. */
const PHASE_SWITCH_FADE_MS = 2000;
/** Fade-out when skipping a track. */
const SKIP_FADE_MS = 600;
/** Fade-out when paused by hand: just enough not to click. */
const PAUSE_FADE_MS = 300;
/** How often to check the games' phase. */
const PHASE_CHECK_INTERVAL_MS = 250;
/** Fade-out when the Spotify player takes over (it starts as this fades, so the two cross). */
export const HANDOVER_FADE_MS = 2000;

function isMusicLevellingModel(value: unknown): value is MusicLevellingModel {
    return typeof value === 'object' && value !== null && typeof (value as MusicLevellingModel).enabled === 'boolean' &&
        typeof (value as MusicLevellingModel).targetLufs === 'number';
}

const LEVELLING_MANAGER = new JSONSingletonResourceManager<MusicLevellingModel>('music_levelling', isMusicLevellingModel);

function isMusicCrossfadeModel(value: unknown): value is MusicCrossfadeModel {
    return typeof value === 'object' && value !== null && typeof (value as MusicCrossfadeModel).enabled === 'boolean' &&
        typeof (value as MusicCrossfadeModel).seconds === 'number';
}

const CROSSFADE_MANAGER = new JSONSingletonResourceManager<MusicCrossfadeModel>('music_crossfade', isMusicCrossfadeModel);

/**
 * Runs the uploaded-music player: one mixer client hosts it (the sound comes out of that device, through its mixer's
 * Music & Ambience master, so the master fader, dim and time-of-day trim apply there), and every client controls it
 * through here. It runs alongside the Spotify player, but only one of the two plays at a time: whichever starts hands
 * the other over, fading it out (see handOver), and only one of them has a preset scheduled. This decides what plays - shuffling each playlist in an order it remembers its place in, following
 * the games' phase for the adaptive and day & night presets, and switching to a scheduled preset at the next phase
 * change - and the host follows the model (see MusicModel), doing the fades itself.
 */
export class MusicHelper extends EventEmitter {
    #hostClientId: string | null = null;
    #hostLastSeen = 0;
    #hostCheckTimer: ReturnType<typeof setInterval> | null = null;
    #gain = DEFAULT_MUSIC_GAIN;
    #track: MusicTrackPlaybackModel | null = null;
    #loadId = 0;
    #playing = false;
    #fadeMs = 0;
    #crossfading = false;
    #presetId: string | null = null;
    #pendingPresetId: string | null = null;
    #pendingTimer: ReturnType<typeof setTimeout> | null = null;
    /**
     * What the preset playing was last switched for: the phase, for an adaptive preset, or for a day & night one, which
     * of its playlists (or 'silent').
     */
    #phaseKey: TimeOfDay | CountdownPhase | 'silent' | null = null;
    /** Whether a day & night preset has paused itself for a silent spell, so resumes by itself when it ends. */
    #silenced = false;
    #scheduledPresetId: string | null = null;
    #lastTimeOfDay: TimeOfDay;
    /** Tracks in a row that failed to play, so a playlist of broken files stops rather than spinning through them. */
    #failures = 0;
    #shuffle = new MusicShuffle();
    #levelling: MusicLevellingModel = { ...DEFAULT_MUSIC_LEVELLING, ...LEVELLING_MANAGER.value };
    #crossfade: MusicCrossfadeModel = { ...DEFAULT_MUSIC_CROSSFADE, ...CROSSFADE_MANAGER.value };

    constructor() {
        super();
        // A track measured (one just uploaded) or set by hand while it's loaded is levelled by that from then on
        musicLoudnessEvents.on('changed', (trackId: string, loudness: number | null) => {
            if (this.#track?.trackId !== trackId) return;
            this.#track = { ...this.#track, loudness };
            this.changed();
        });
        this.#lastTimeOfDay = getBOTCTClockInstanceManager().timeOfDay;
        const phaseTimer = setInterval(() => this.checkPhase(), PHASE_CHECK_INTERVAL_MS);
        phaseTimer.unref?.();
    }

    on(eventName: 'update', listener: (model: MusicModel) => void): this;
    on(eventName: string | symbol, listener: (...args: any[]) => void): this {
        return super.on(eventName, listener);
    }

    get model(): MusicModel {
        return {
            hostClientId: this.#hostClientId,
            gain: this.#gain,
            track: this.#track,
            loadId: this.#loadId,
            playing: this.#playing,
            fadeMs: this.#fadeMs,
            crossfading: this.#crossfading,
            presetId: this.#presetId,
            pendingPresetId: this.#pendingPresetId,
            presetSilent: this.#silenced,
            scheduledPresetId: this.#scheduledPresetId,
            levelling: { ...this.#levelling },
            crossfade: { ...this.#crossfade }
        };
    }

    private changed() {
        this.emit('update', this.model);
    }

    // ---- Player host (the one client the sound comes out of) ----

    /** Claims the player for a client. Throws if another client holds a live claim. */
    claimHost(clientId: string) {
        this.expireStaleHost();
        if (this.#hostClientId !== null && this.#hostClientId !== clientId) throw new Error('Another client is already running the music player');
        if (this.#hostClientId !== clientId) {
            this.#hostClientId = clientId;
            this.#hostCheckTimer = setInterval(() => this.expireStaleHost(true), HOST_CHECK_INTERVAL_MS);
            this.#hostCheckTimer.unref?.();
        }
        this.#hostLastSeen = Date.now();
        this.changed();
    }

    releaseHost(clientId: string) {
        if (this.#hostClientId !== clientId) return;
        this.releaseHostInternal();
        this.changed();
    }

    private releaseHostInternal() {
        this.#hostClientId = null;
        this.#track = null;
        this.#playing = false;
        this.#fadeMs = 0;
        this.#presetId = null;
        this.#phaseKey = null;
        this.#silenced = false;
        this.#scheduledPresetId = null;
        this.clearPending();
        if (this.#hostCheckTimer) {
            clearInterval(this.#hostCheckTimer);
            this.#hostCheckTimer = null;
        }
    }

    private expireStaleHost(notify = false) {
        if (this.#hostClientId !== null && Date.now() - this.#hostLastSeen > HOST_TIMEOUT_MS) {
            console.log("Music host went quiet, releasing", this.#hostClientId);
            this.releaseHostInternal();
            if (notify) this.changed();
        }
    }

    /**
     * Heartbeat from the host, optionally reporting that the track it was told to play (`loadId`) ended or failed, or is
     * near enough its end to crossfade into the playlist's next track.
     */
    hostReport(clientId: string, report: { event?: MusicHostEvent, loadId?: number }) {
        if (this.#hostClientId !== clientId) throw new Error('Not the music player host');
        this.#hostLastSeen = Date.now();
        // Only about the track playing now; one from before a switch is old news
        if (report.event === undefined || report.loadId !== this.#loadId || !this.#track) return;
        const playlistId = this.#track.playlistId;
        if (report.event === 'crossfade') {
            // (Switched off since, or paused: it'll report the track ending instead)
            if (!this.#crossfade.enabled || !this.#playing) return;
            this.#failures = 0;
            this.startPlaylist(playlistId, this.#crossfade.seconds * 1000, true);
            return;
        }
        if (report.event === 'ended') {
            this.#failures = 0;
        } else {
            console.warn(`Music: couldn't play "${this.#track.title}", skipping it`);
            this.#failures++;
            const size = getMusicPlaylist(playlistId)?.trackIds.length ?? 0;
            if (this.#failures >= Math.max(1, size)) {
                console.warn('Music: no track in the playlist would play, stopping');
                this.#failures = 0;
                this.#playing = false;
                this.#fadeMs = 0;
                this.changed();
                return;
            }
        }
        this.startPlaylist(playlistId, 0);
    }

    // ---- Remote control (any client) ----

    control(command: MusicControlAction) {
        this.expireStaleHost(true);
        if (this.#hostClientId === null) throw new Error('The music player is not running');
        switch (command.action) {
            case 'play':
                // Played by hand, a silent day & night preset is just playing now
                this.#silenced = false;
                if (this.#track) this.resume();
                else if (this.#presetId) this.playPreset(this.#presetId, FADE_MS);
                break;
            case 'pause':
                // Paused by hand, a day & night preset stays paused rather than coming back by itself, and nothing
                // scheduled (on either player) starts up at the next phase change either
                this.#silenced = false;
                this.#scheduledPresetId = null;
                if (this.#playing) getSpotifyHelperInstance().clearScheduledPreset();
                this.pause(PAUSE_FADE_MS);
                break;
            // Skipping stays in the playlist, so crossfades if that's on
            case 'next':
                if (this.#track) this.startPlaylist(this.#track.playlistId, this.skipFadeMs, this.#crossfade.enabled);
                break;
            case 'previous': {
                if (!this.#track) break;
                const playlistId = this.#track.playlistId;
                const trackId = this.#shuffle.previous(playlistId, getMusicPlaylist(playlistId)?.trackIds ?? []);
                if (trackId) this.load(trackId, playlistId, this.skipFadeMs, this.#crossfade.enabled);
                break;
            }
            case 'playPreset':
                // Picked to play now instead
                this.#scheduledPresetId = null;
                getSpotifyHelperInstance().clearScheduledPreset();
                this.playPreset(command.presetId, FADE_MS);
                break;
            case 'schedulePreset':
                if (command.presetId !== null && !this.findPreset(command.presetId)) throw new Error('Unknown preset');
                // Only one preset waits for the phase change, whichever player it's for
                if (command.presetId !== null) getSpotifyHelperInstance().clearScheduledPreset();
                this.#scheduledPresetId = command.presetId;
                this.changed();
                break;
            case 'gain': {
                if (typeof command.gain !== 'number' || isNaN(command.gain)) throw new Error('Invalid gain');
                this.#gain = Math.min(MAX_MUSIC_GAIN, Math.max(0, command.gain));
                this.changed();
                break;
            }
            default:
                throw new Error('Unknown action');
        }
    }

    /**
     * The Spotify player is taking over: fades out and pauses, as if paused by hand, so a day & night preset waiting out
     * a silent spell doesn't start up again by itself. The preset stays loaded, to carry on with when picked again.
     */
    handOver(fadeMs = HANDOVER_FADE_MS) {
        if (this.#hostClientId === null) return;
        const wasSilenced = this.#silenced;
        this.#silenced = false;
        if (this.#playing) this.pause(fadeMs);
        else if (wasSilenced) this.changed();
    }

    /** Drops the preset scheduled for the next phase change (one's been scheduled, or picked to play now, on Spotify). */
    clearScheduledPreset() {
        if (this.#scheduledPresetId === null) return;
        this.#scheduledPresetId = null;
        this.changed();
    }

    /** Has the Spotify player fade out, as this starts playing. */
    private takeOver() {
        getSpotifyHelperInstance().handOver(HANDOVER_FADE_MS);
    }

    /** Validates and applies a patch to the loudness levelling settings ({ enabled?, targetLufs? }). Throws on an invalid field. */
    updateLevelling(patch: Record<string, unknown>) {
        const levelling = { ...this.#levelling };
        if (patch.enabled !== undefined) {
            if (typeof patch.enabled !== 'boolean') throw new Error('Invalid enabled');
            levelling.enabled = patch.enabled;
        }
        if (patch.targetLufs !== undefined) {
            if (typeof patch.targetLufs !== 'number' || !isFinite(patch.targetLufs)) throw new Error('Invalid targetLufs');
            levelling.targetLufs = clampLevellingTarget(patch.targetLufs);
        }
        if (levelling.enabled === this.#levelling.enabled && levelling.targetLufs === this.#levelling.targetLufs) return;
        this.#levelling = levelling;
        LEVELLING_MANAGER.save(levelling);
        this.changed();
    }

    /** How long a skip takes: the crossfade, if that's on, or otherwise a quick fade-out. */
    private get skipFadeMs() {
        return this.#crossfade.enabled ? this.#crossfade.seconds * 1000 : SKIP_FADE_MS;
    }

    /** Validates and applies a patch to the crossfade settings ({ enabled?, seconds? }). Throws on an invalid field. */
    updateCrossfade(patch: Record<string, unknown>) {
        const crossfade = { ...this.#crossfade };
        if (patch.enabled !== undefined) {
            if (typeof patch.enabled !== 'boolean') throw new Error('Invalid enabled');
            crossfade.enabled = patch.enabled;
        }
        if (patch.seconds !== undefined) {
            if (typeof patch.seconds !== 'number' || !isFinite(patch.seconds)) throw new Error('Invalid seconds');
            crossfade.seconds = clampCrossfadeSeconds(patch.seconds);
        }
        if (crossfade.enabled === this.#crossfade.enabled && crossfade.seconds === this.#crossfade.seconds) return;
        this.#crossfade = crossfade;
        CROSSFADE_MANAGER.save(crossfade);
        this.changed();
    }

    // ---- Presets ----

    private findPreset(id: string | null): MusicPreset | undefined {
        return id === null ? undefined : getMusicPresets().find(p => p.id === id);
    }

    /** A preset's playlist, if it (still) exists. */
    private existing(playlistId: string | null): string | null {
        return playlistId !== null && getMusicPlaylist(playlistId) ? playlistId : null;
    }

    /**
     * Starts a preset: on its playlist for now (an adaptive preset's phase, or for a day & night one, the countdown or
     * the night - or silence), carrying on where it left off if that playlist is already loaded. Adaptive and day &
     * night presets follow the phase from then on.
     */
    private playPreset(presetId: string, fadeMs: number) {
        const preset = this.findPreset(presetId);
        if (!preset) throw new Error('Unknown preset');
        if (isMusicCountdownPreset(preset)) return this.playCountdownPreset(preset, fadeMs);
        let playlistId: string | null;
        let resume: boolean;
        let phaseKey: TimeOfDay | null = null;
        if (isMusicAdaptivePreset(preset)) {
            const timeOfDay = phaseKey = getBOTCTClockInstanceManager().timeOfDay;
            const own = this.existing(preset.phasePlaylistIds[timeOfDay]);
            playlistId = own ?? this.existing(adaptiveMusicPlaylistFor(preset, timeOfDay));
            // Already loaded (just paused) on this phase's playlist - or on any of its playlists, if this phase has
            // none to switch to: carry on where it left off
            const loadedOwn = this.#track !== null && musicPresetPlaylistIds(preset).includes(this.#track.playlistId);
            resume = (this.#presetId === presetId && loadedOwn && (own === null || this.isLoaded(own))) || this.isLoaded(playlistId);
        } else {
            playlistId = this.existing(preset.playlistId);
            resume = this.isLoaded(playlistId);
        }
        if (playlistId === null) throw new Error(`"${preset.name}" has no playlist to play`);
        this.takeOver();
        this.#presetId = presetId;
        this.#phaseKey = phaseKey;
        this.#silenced = false;
        if (resume) this.resume();
        else this.switchTo(playlistId, fadeMs, presetId);
    }

    /** Starts a day & night preset on its playlist for now, or silences the player if now has none. */
    private playCountdownPreset(preset: MusicCountdownPreset, fadeMs: number) {
        const phase = this.countdownPhase();
        // Picked, so it takes over even when it starts out silent
        this.takeOver();
        this.#presetId = preset.id;
        this.#phaseKey = phase;
        const playlistId = phase === 'silent' ? null : this.existing(preset.countdownPlaylistIds[phase]);
        if (playlistId === null) {
            this.#silenced = true;
            if (this.#playing) this.pause(fadeMs);
            else this.changed();
            return;
        }
        this.#silenced = false;
        if (this.isLoaded(playlistId)) this.resume();
        else this.switchTo(playlistId, fadeMs, preset.id);
    }

    /** Which of a day & night preset's playlists plays now: day while a countdown runs, night at night, otherwise none. */
    private countdownPhase(): CountdownPhase | 'silent' {
        const manager = getBOTCTClockInstanceManager();
        if (manager.countdownRunning) return 'day';
        return manager.timeOfDay === 'night' ? 'night' : 'silent';
    }

    /** On a change of the games' phase, switches to a scheduled preset, or has the playing preset follow the phase. */
    private checkPhase() {
        const timeOfDay = getBOTCTClockInstanceManager().timeOfDay;
        const phaseChanged = timeOfDay !== this.#lastTimeOfDay;
        this.#lastTimeOfDay = timeOfDay;
        if (this.#hostClientId === null) return;
        try {
            if (phaseChanged && this.#scheduledPresetId !== null) this.applyScheduledPreset();
            this.followPreset();
        } catch (e) {
            console.error('Music: failed to follow the phase', e);
        }
    }

    private applyScheduledPreset() {
        const preset = this.findPreset(this.#scheduledPresetId);
        this.#scheduledPresetId = null;
        if (!preset) return this.changed();
        console.log(`Music: phase changed, switching to the scheduled preset "${preset.name}"`);
        this.playPreset(preset.id, PHASE_SWITCH_FADE_MS);
    }

    /** Has the playing adaptive or day & night preset follow a change of phase (or of the countdown). */
    private followPreset() {
        if (this.#presetId === null) return;
        const preset = this.findPreset(this.#presetId);
        if (!preset) {
            // Deleted in settings since it was started
            this.#presetId = null;
            this.#phaseKey = null;
            this.#silenced = false;
            return this.changed();
        }
        if (isMusicCountdownPreset(preset)) {
            const phase = this.countdownPhase();
            if (phase === this.#phaseKey) return;
            this.#phaseKey = phase;
            this.followCountdown(preset, phase);
        } else if (isMusicAdaptivePreset(preset)) {
            const timeOfDay = getBOTCTClockInstanceManager().timeOfDay;
            if (timeOfDay === this.#phaseKey) return;
            this.#phaseKey = timeOfDay;
            this.followAdaptive(preset, timeOfDay);
        }
    }

    /**
     * Moves a day & night preset on to its playlist for now: fading out and pausing for a silent spell, and starting
     * (or resuming) the playlist when one comes round. One paused by hand is left alone.
     */
    private followCountdown(preset: MusicCountdownPreset, phase: CountdownPhase | 'silent') {
        if (!this.#playing && !this.#silenced) return;
        const playlistId = phase === 'silent' ? null : this.existing(preset.countdownPlaylistIds[phase]);
        if (playlistId === null) {
            if (!this.#playing) return;
            console.log(`Music: "${preset.name}" going silent`);
            this.#silenced = true;
            this.pause(PHASE_SWITCH_FADE_MS);
            return;
        }
        this.#silenced = false;
        if (this.isLoaded(playlistId)) {
            if (!this.#playing) {
                console.log(`Music: "${preset.name}" resuming for ${phase}`);
                this.resume();
            }
            return;
        }
        console.log(`Music: "${preset.name}" switching to its ${phase} playlist`);
        this.switchTo(playlistId, PHASE_SWITCH_FADE_MS, preset.id);
    }

    /** Switches a playing adaptive preset to the new phase's playlist, unless it has none or it's already on it. */
    private followAdaptive(preset: MusicAdaptivePreset, timeOfDay: TimeOfDay) {
        // A paused preset is left alone; starting it again picks the new phase's playlist
        if (!this.#playing) return;
        const playlistId = this.existing(preset.phasePlaylistIds[timeOfDay]);
        if (playlistId === null || this.isLoaded(playlistId)) return;
        console.log(`Music: phase changed to ${timeOfDay}, switching "${preset.name}" playlist`);
        this.switchTo(playlistId, PHASE_SWITCH_FADE_MS, preset.id);
    }

    // ---- Playing ----

    private isLoaded(playlistId: string | null) {
        return playlistId !== null && this.#track?.playlistId === playlistId;
    }

    /** Fades over to the playlist's next track, marking the preset as being switched to while the old track fades. */
    private switchTo(playlistId: string, fadeMs: number, presetId: string) {
        if (this.#playing && fadeMs > 0) {
            this.clearPending();
            this.#pendingPresetId = presetId;
            this.#pendingTimer = setTimeout(() => {
                this.#pendingTimer = null;
                this.#pendingPresetId = null;
                this.changed();
            }, fadeMs);
        }
        this.startPlaylist(playlistId, fadeMs);
    }

    private clearPending() {
        if (this.#pendingTimer) clearTimeout(this.#pendingTimer);
        this.#pendingTimer = null;
        this.#pendingPresetId = null;
    }

    /**
     * Moves on to the playlist's next track in its shuffled order (crossfading into it, if asked to, rather than fading
     * out first); stops if it has none.
     */
    private startPlaylist(playlistId: string, fadeMs: number, crossfade = false) {
        const trackId = this.#shuffle.next(playlistId, getMusicPlaylist(playlistId)?.trackIds ?? []);
        if (trackId === null) {
            console.warn('Music: the playlist is empty');
            this.clearPending();
            this.pause(fadeMs);
            return;
        }
        this.load(trackId, playlistId, fadeMs, crossfade);
    }

    /**
     * Has the host fade out what it's playing (if anything) and start the track from the top - or, crossfading, start
     * it while what's playing fades out.
     */
    private load(trackId: string, playlistId: string, fadeMs: number, crossfade = false) {
        const track = getMusicTrack(trackId);
        if (!track) return;
        const album = track.albumId === null ? undefined : getMusicAlbum(track.albumId);
        this.#crossfading = crossfade && this.#playing;
        this.#fadeMs = this.#playing ? fadeMs : 0;
        this.#track = {
            trackId,
            playlistId,
            title: track.title,
            artist: track.artist,
            album: album?.title ?? '',
            imageUrl: album?.artwork ? `/api/resources/${album.artwork}` : null,
            url: `/api/resources/${track.file}`,
            loudness: track.loudness ?? null
        };
        this.#loadId++;
        if (!this.#playing) this.takeOver();
        this.#playing = true;
        this.changed();
    }

    private resume() {
        if (!this.#track) return;
        if (!this.#playing) this.takeOver();
        this.#playing = true;
        this.#fadeMs = 0;
        this.changed();
    }

    private pause(fadeMs: number) {
        this.#playing = false;
        this.#fadeMs = fadeMs;
        this.changed();
    }
}

var instance: MusicHelper;

export function getMusicHelperInstance() {
    if (instance === undefined) {
        instance = new MusicHelper();
    }
    return instance;
}
