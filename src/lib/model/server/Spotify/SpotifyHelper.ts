import { EventEmitter } from "node:events";
import { env } from "$env/dynamic/private";
import type { SpotifyControlAction, SpotifyModel, SpotifyPlaybackModel, SpotifyStartTrack, SpotifyTrackItem } from "$lib/audio/common/model/spotifyModel";
import { DIM_FADE_MS, type AudioDimModel } from "$lib/audio/common/model/audioDimModel";
import { getAudioDimHelperInstance } from "../AudioDim/AudioDimHelper";
import { getTimeOfDayTrimHelperInstance } from "../TimeOfDayTrim/TimeOfDayTrimHelper";
import { getMixerMastersHelperInstance } from "../MixerMasters/MixerMastersHelper";
import { isAdaptivePresetContext, isSameSpotifyContext, isSpotifyAdaptivePreset, isSpotifyContextUri, type SpotifyAdaptivePreset } from "$lib/audio/common/spotifyPreset";
import { JSONSingletonResourceManager } from "$lib/resources/server/jsonResourceManager";
import { getSpotifyPresets } from "$lib/resources/server/spotifyPresets";
import { getBOTCTClockInstanceManager } from "../model";
import { getMusicHelperInstance, HANDOVER_FADE_MS } from "../Music/MusicHelper";
import type { TimeOfDay } from "$lib/model/client/types";

type SpotifyAuth = { refreshToken: string };

function isSpotifyAuth(value: unknown): value is SpotifyAuth {
    return typeof value === 'object' && value !== null && typeof (value as SpotifyAuth).refreshToken === 'string';
}

const AUTH_MANAGER = new JSONSingletonResourceManager<SpotifyAuth>('spotify_auth', isSpotifyAuth);

const SCOPES = ['streaming', 'user-read-email', 'user-read-private', 'user-modify-playback-state', 'user-read-playback-state',
    // To list a playlist's tracks, to pick one to start with
    'playlist-read-private', 'playlist-read-collaborative'];
/** The host reports in every few seconds; if it goes quiet for this long its claim lapses and another client may take over. */
const HOST_TIMEOUT_MS = 15000;
/** Fade-out time when switching playlists. */
const FADE_MS = 1200;
/** Fade-out time when an adaptive playlist switches to the new phase's list - longer, as it's not something the user just clicked. */
const PHASE_SWITCH_FADE_MS = 2000;
/** How long to wait for the player to report the new playlist before giving up and restoring volume anyway. */
const SWITCH_TIMEOUT_MS = 4000;
/** Step interval of the volume fades. Steps go straight to the host's player (see setDeviceVolume), not to Spotify, so can be fine. */
const FADE_STEP_MS = 25;
/** How long the volume takes to move to the new phase's time-of-day trim - in step with the mixer's own fade. */
const TRIM_FADE_MS = 3000;
const HOST_CHECK_INTERVAL_MS = 5000;
/** How often to check the games' phase (for adaptive playlists and the time-of-day trim). */
const PHASE_CHECK_INTERVAL_MS = 250;
/** How long an album/playlist's tracks, once listed, are kept rather than asked for again. */
const TRACK_LIST_TTL_MS = 60000;
/** The most tracks listed of an album/playlist (Spotify gives them 50 at a time). */
const MAX_LISTED_TRACKS = 1000;

/**
 * Runs the Spotify player. It runs alongside the uploaded-music player (see MusicHelper), but only one of the two plays
 * at a time: whichever starts hands the other over, fading it out, and only one of them has a preset scheduled.
 */
export class SpotifyHelper extends EventEmitter {
    #hostClientId: string | null = null;
    #hostDeviceId: string | null = null;
    #hostLastSeen = 0;
    #hostCheckTimer: ReturnType<typeof setInterval> | null = null;
    #playback: SpotifyPlaybackModel | null = null;
    #volume = 50;
    #fadeToken = 0;
    #pendingContextUri: string | null = null;
    /** The shared audio dim, applied to every volume we send to Spotify, in dB (0, or ramping to/from -amountDb). */
    #dimDb = 0;
    #dimModel: AudioDimModel;
    #dimToken = 0;
    #dimRamping = false;
    /** True while a playlist switch is fading/starting, so a dim change doesn't fight the fade. */
    #switching = false;
    /** The adaptive playlist last started, if it's still the thing selected. */
    #adaptivePresetId: string | null = null;
    /** The phase the selected adaptive playlist was last switched for. */
    #phaseKey: TimeOfDay | null = null;
    /** Whether an adaptive playlist has paused itself for a silent spell, so resumes by itself when it ends. */
    #silenced = false;
    /** The preset to switch to at the next change of the games' phase. */
    #scheduledPresetId: string | null = null;
    /** The track the scheduled preset starts with, if one's been picked. */
    #scheduledStartTrack: SpotifyStartTrack | null = null;
    /** Albums/playlists' tracks listed lately, by context URI. */
    #trackLists = new Map<string, { at: number, name: string, tracks: SpotifyTrackItem[] }>();
    /**
     * Whether the music player has taken over since this last started something. The playback the host reports lags
     * the pause, so this, not that, keeps an adaptive playlist from following the phase back into playing meanwhile.
     */
    #handedOver = false;
    /**
     * The shared time-of-day trim (on the Music & Ambience master) currently applied to every volume we send, in dB.
     * Applied here rather than by the mixers, so that it and a playlist switch's fades are one ramp, not two fighting.
     */
    #trimDb: number;
    /** The phase whose trim #trimDb is at, or ramping towards. */
    #trimTimeOfDay: TimeOfDay;
    #trimToken = 0;
    #trimRamping = false;
    /** The volume (0..1, master gain, dim and trim included) last sent to the host's player. */
    #deviceVolume: number | null = null;

    constructor() {
        super();
        const dim = getAudioDimHelperInstance();
        this.#dimModel = dim.model;
        this.#dimDb = this.targetDimDb();
        dim.on('update', (model) => {
            const dimmedChanged = model.dimmed !== this.#dimModel.dimmed;
            this.#dimModel = model;
            if (dimmedChanged) {
                this.rampDim();
            } else if (!this.#dimRamping) {
                // The amount being changed is followed straight away (a ramp in progress picks it up as it goes)
                this.#dimDb = this.targetDimDb();
                this.applyLevelChange('audio dim');
            }
        });

        this.#trimTimeOfDay = getBOTCTClockInstanceManager().timeOfDay;
        this.#trimDb = this.targetTrimDb();
        getTimeOfDayTrimHelperInstance().on('update', () => {
            // A ramp or switch in progress picks the new value up as it goes
            if (this.#trimRamping || this.#switching) return;
            this.#trimDb = this.targetTrimDb();
            this.applyLevelChange('time-of-day trim');
        });

        getMixerMastersHelperInstance().on('update', () => this.applyLevelChange('master gain'));

        const phaseTimer = setInterval(() => this.checkPhase(), PHASE_CHECK_INTERVAL_MS);
        phaseTimer.unref?.();
    }

    /** Re-sends the volume after the master gain, dim or trim changes - unless a fade is under way, which applies it itself. */
    private applyLevelChange(what: string) {
        const deviceId = this.#hostDeviceId;
        if (deviceId === null || this.#switching || this.#trimRamping) return;
        this.setDeviceVolume(`device_id=${encodeURIComponent(deviceId)}`, this.#volume)
            .catch((e) => console.error(`Failed to apply ${what} to Spotify`, e));
    }

    #accessToken: string | null = null;
    #accessTokenExpiresAt = 0;
    /** The scopes the linked account granted, as of the last token (null before one's been fetched). */
    #grantedScopes: string[] | null = null;

    on(eventName: 'update', listener: (model: SpotifyModel) => void): this;
    /** The host's player should set its volume to this (0..1). */
    on(eventName: 'deviceVolume', listener: (hostClientId: string, volume: number) => void): this;
    on(eventName: string | symbol, listener: (...args: any[]) => void): this {
        return super.on(eventName, listener);
    }

    get configured() { return !!env.SPOTIFY_CLIENT_ID && !!env.SPOTIFY_CLIENT_SECRET; }
    get authorized() { return AUTH_MANAGER.value !== null; }

    get model(): SpotifyModel {
        return {
            configured: this.configured,
            authorized: this.authorized,
            hostClientId: this.#hostClientId,
            hostReady: this.#hostClientId !== null && this.#hostDeviceId !== null,
            volume: this.#volume,
            playback: this.#playback,
            pendingContextUri: this.#pendingContextUri,
            adaptivePresetId: this.#adaptivePresetId,
            adaptivePresetSilent: this.#silenced,
            scheduledPresetId: this.#scheduledPresetId,
            scheduledStartTrack: this.#scheduledStartTrack,
            handedOver: this.#handedOver
        };
    }

    private changed() {
        this.emit('update', this.model);
    }

    // ---- Account linking (authorization code flow) ----

    authorizeUrl(redirectUri: string, state: string): string {
        if (!this.configured) throw new Error('Spotify is not configured on the server');
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: env.SPOTIFY_CLIENT_ID!,
            scope: SCOPES.join(' '),
            redirect_uri: redirectUri,
            state
        });
        return `https://accounts.spotify.com/authorize?${params}`;
    }

    async completeAuth(code: string, redirectUri: string) {
        const body = await this.tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });
        if (typeof body.refresh_token !== 'string') throw new Error('Spotify did not return a refresh token');
        AUTH_MANAGER.save({ refreshToken: body.refresh_token });
        this.storeAccessToken(body);
        this.changed();
    }

    private async tokenRequest(params: Record<string, string>) {
        const basic = Buffer.from(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`).toString('base64');
        const res = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: { 'Authorization': `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(params)
        });
        if (!res.ok) throw new Error(`Spotify token request failed: ${res.status} ${await res.text()}`);
        return await res.json();
    }

    private storeAccessToken(body: { access_token: string, expires_in: number, scope?: string }) {
        this.#accessToken = body.access_token;
        if (typeof body.scope === 'string') this.#grantedScopes = body.scope.split(' ');
        this.#accessTokenExpiresAt = Date.now() + body.expires_in * 1000;
    }

    async getAccessToken(): Promise<string> {
        if (!this.configured) throw new Error('Spotify is not configured on the server');
        const auth = AUTH_MANAGER.value;
        if (!auth) throw new Error('No Spotify account linked');
        // Refresh a minute early so a token can't expire mid-request
        if (this.#accessToken === null || Date.now() > this.#accessTokenExpiresAt - 60000) {
            const body = await this.tokenRequest({ grant_type: 'refresh_token', refresh_token: auth.refreshToken });
            this.storeAccessToken(body);
            // Spotify only sometimes rotates the refresh token
            if (typeof body.refresh_token === 'string' && body.refresh_token !== auth.refreshToken) {
                AUTH_MANAGER.save({ refreshToken: body.refresh_token });
            }
        }
        return this.#accessToken!;
    }

    unlink() {
        this.releaseHostInternal();
        AUTH_MANAGER.clear();
        this.#accessToken = null;
        this.#grantedScopes = null;
        this.changed();
    }

    // ---- Player host (the one client that runs the Web Playback SDK) ----

    /** Claims the player for a client. Throws if another client holds a live claim. */
    claimHost(clientId: string) {
        if (!this.authorized) throw new Error('No Spotify account linked');
        this.expireStaleHost();
        if (this.#hostClientId !== null && this.#hostClientId !== clientId) {
            throw new Error('Another client is already running the Spotify player');
        }
        if (this.#hostClientId !== clientId) {
            this.#hostClientId = clientId;
            this.#hostDeviceId = null;
            this.#playback = null;
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
        this.#hostDeviceId = null;
        this.#playback = null;
        this.#pendingContextUri = null;
        this.#deviceVolume = null;
        this.clearAdaptivePreset();
        this.setScheduledPreset(null);
        this.#handedOver = false;
        if (this.#hostCheckTimer) {
            clearInterval(this.#hostCheckTimer);
            this.#hostCheckTimer = null;
        }
    }

    private expireStaleHost(notify = false) {
        if (this.#hostClientId !== null && Date.now() - this.#hostLastSeen > HOST_TIMEOUT_MS) {
            console.log("Spotify host went quiet, releasing", this.#hostClientId);
            this.releaseHostInternal();
            if (notify) this.changed();
        }
    }

    private assertHost(clientId: string) {
        if (this.#hostClientId !== clientId) throw new Error('Not the Spotify player host');
    }

    /** Heartbeat from the host, optionally carrying its latest playback state. */
    hostReport(clientId: string, report: { playback?: SpotifyPlaybackModel | null }) {
        this.assertHost(clientId);
        this.#hostLastSeen = Date.now();
        // Until the player's (re)registered with Spotify, what it last had isn't playing anywhere
        if (report.playback !== undefined && this.#hostDeviceId !== null) {
            this.#playback = report.playback;
            // Something else was picked in Spotify itself, so the adaptive playlist is no longer selected
            const adaptivePreset = this.adaptivePreset();
            if (adaptivePreset && !this.#switching && report.playback?.playing && report.playback.contextUri &&
                !isAdaptivePresetContext(adaptivePreset, report.playback.contextUri)) {
                this.clearAdaptivePreset();
            }
            this.changed();
        }
    }

    /** The host's SDK player is registered with Spotify: make it the active playback device. */
    async hostReady(clientId: string, deviceId: string) {
        this.assertHost(clientId);
        this.#hostLastSeen = Date.now();
        this.#hostDeviceId = deviceId;
        await this.api('PUT', '/me/player', { device_ids: [deviceId], play: false });
        // The SDK starts at the volume without the master gain, dim or trim
        this.#deviceVolume = null;
        await this.setDeviceVolume(`device_id=${encodeURIComponent(deviceId)}`, this.#volume);
        this.changed();
    }

    /** The host's SDK player has gone offline: it reconnects, and reports its device again once it's back. */
    hostOffline(clientId: string) {
        this.assertHost(clientId);
        this.#hostLastSeen = Date.now();
        this.deviceLost();
    }

    /**
     * Spotify no longer knows the host's player (it dropped off, after a network blip, say). Nothing can play until the
     * host reconnects it, so it stops counting as ready - and its last playback as playing, which would otherwise have
     * the remotes treat Spotify as still playing, and send everything its way. The host reconnects on seeing this.
     */
    private deviceLost() {
        if (this.#hostDeviceId === null) return;
        console.log('Spotify: the player has dropped off Spotify, waiting for the host to reconnect it');
        this.#hostDeviceId = null;
        this.#playback = null;
        this.#pendingContextUri = null;
        this.#deviceVolume = null;
        this.changed();
    }

    /** Returns a token for the host's SDK. Only the current host may have one. */
    async hostToken(clientId: string) {
        this.assertHost(clientId);
        this.#hostLastSeen = Date.now();
        return await this.getAccessToken();
    }

    // ---- Remote control (any client) ----

    async control(command: SpotifyControlAction) {
        this.expireStaleHost(true);
        const deviceId = this.#hostDeviceId;
        if (deviceId === null) throw new Error('The Spotify player is not running');
        const device = `device_id=${encodeURIComponent(deviceId)}`;
        switch (command.action) {
            case 'play':
                // Played by hand, a silent adaptive playlist is just playing now (and the fade to silence left it at 0)
                this.#silenced = false;
                this.takeOver();
                await this.setDeviceVolume(device, this.#volume);
                await this.api('PUT', `/me/player/play?${device}`);
                this.changed();
                break;
            case 'pause':
                // Paused by hand, an adaptive playlist stays paused rather than coming back by itself, and nothing
                // scheduled (on either player) starts up at the next phase change either
                this.#silenced = false;
                this.setScheduledPreset(null);
                if (this.#playback?.playing) getMusicHelperInstance().clearScheduledPreset();
                await this.api('PUT', `/me/player/pause?${device}`);
                this.changed();
                break;
            case 'playContext':
                if (!isSpotifyContextUri(command.uri)) throw new Error('Invalid album/playlist');
                this.clearAdaptivePreset();
                // Picked to play now instead
                this.setScheduledPreset(null);
                getMusicHelperInstance().clearScheduledPreset();
                this.takeOver();
                if (this.isLoadedContext(command.uri)) await this.resumeLoadedContext(device);
                else await this.playContext(command.uri, device);
                break;
            case 'playAdaptivePreset':
                // Picked to play now instead
                this.setScheduledPreset(null);
                getMusicHelperInstance().clearScheduledPreset();
                await this.playAdaptivePreset(command.presetId, device);
                break;
            case 'schedulePreset':
                if (command.presetId !== null && !getSpotifyPresets().some(p => p.id === command.presetId)) throw new Error('Unknown preset');
                // Only one preset waits for the phase change, whichever player it's for
                if (command.presetId !== null) getMusicHelperInstance().clearScheduledPreset();
                this.setScheduledPreset(command.presetId);
                this.changed();
                break;
            case 'scheduleStartTrack':
                this.#scheduledStartTrack = command.start === null ? null : await this.startTrack(command.start);
                this.changed();
                break;
            case 'next':
                // Skipping starts a paused player, which a hand-over or silent spell left at 0
                this.takeOver();
                if (!this.#playback?.playing && !this.#switching) await this.setDeviceVolume(device, this.#volume);
                await this.api('POST', `/me/player/next?${device}`);
                break;
            case 'previous':
                this.takeOver();
                if (!this.#playback?.playing && !this.#switching) await this.setDeviceVolume(device, this.#volume);
                await this.api('POST', `/me/player/previous?${device}`);
                break;
            case 'volume': {
                if (typeof command.volume !== 'number' || isNaN(command.volume)) throw new Error('Invalid volume');
                const volume = Math.round(Math.min(100, Math.max(0, command.volume)));
                this.#volume = volume;
                // Mid-switch, the fades follow #volume as they go; setting it on the device now would cut across them
                if (!this.#switching) await this.setDeviceVolume(device, volume);
                this.changed();
                break;
            }
            default:
                throw new Error('Unknown action');
        }
    }

    // ---- Sharing with the music player ----

    /**
     * The music player is taking over: fades out and pauses, as if paused by hand, so an adaptive
     * playlist doesn't follow the phase back into playing. It stays selected, to carry on with when picked again.
     */
    handOver(fadeMs = HANDOVER_FADE_MS) {
        const deviceId = this.#hostDeviceId;
        if (deviceId === null) return;
        this.#handedOver = true;
        this.#silenced = false;
        if (!this.#playback?.playing && !this.#switching) return this.changed();
        console.log('Spotify: the music player is taking over, fading out');
        this.fadeOutAndPause(`device_id=${encodeURIComponent(deviceId)}`, fadeMs)
            .catch((e) => console.error('Failed to fade Spotify out for the music player', e));
    }

    /** Drops the preset scheduled for the next phase change (one's been scheduled, or picked to play now, on the music player). */
    clearScheduledPreset() {
        if (this.#scheduledPresetId === null) return;
        this.setScheduledPreset(null);
        this.changed();
    }

    /** Schedules a preset for the next phase change (or none), forgetting the track picked for the last one to start with. */
    private setScheduledPreset(presetId: string | null) {
        if (presetId !== this.#scheduledPresetId) this.#scheduledStartTrack = null;
        this.#scheduledPresetId = presetId;
    }

    /** A track for the scheduled preset to start with: one on one of its lists. Throws if it isn't. */
    private async startTrack(start: { contextUri: unknown, uri: unknown }): Promise<SpotifyStartTrack> {
        const presetId = this.#scheduledPresetId;
        const preset = getSpotifyPresets().find(p => p.id === presetId);
        if (!preset) throw new Error('No preset is waiting for the next phase');
        const { contextUri, uri } = start ?? {};
        const uris = isSpotifyAdaptivePreset(preset) ? Object.values(preset.phaseUris) : [preset.uri];
        const listUri = typeof contextUri === 'string' ? uris.find(u => isSameSpotifyContext(u, contextUri)) : undefined;
        if (!listUri) throw new Error(`That album/playlist isn't one of "${preset.name}"'s`);
        const track = (await this.trackList(listUri)).tracks.find(t => t.uri === uri);
        if (!track) throw new Error("That track isn't on the album/playlist");
        // (Rescheduled while the tracks were being listed)
        if (this.#scheduledPresetId !== presetId) throw new Error('The preset waiting for the next phase has changed');
        return { contextUri: listUri, uri: track.uri, title: track.title, artist: track.artist };
    }

    // ---- Listing tracks ----

    /**
     * An album/playlist's name and tracks (only those that can be started on: no local files or episodes). Spotify only
     * lists the tracks of playlists the account owns or collaborates on. Throws, saying why, if it won't list them.
     */
    async trackList(contextUri: string): Promise<{ name: string, tracks: SpotifyTrackItem[] }> {
        if (!isSpotifyContextUri(contextUri)) throw new Error('Invalid album/playlist');
        const cached = this.#trackLists.get(contextUri);
        if (cached && Date.now() - cached.at < TRACK_LIST_TTL_MS) return cached;
        const [kind, id] = contextUri.split(':').slice(1);
        const item = (track: any, album?: any): SpotifyTrackItem | null => {
            if (track?.type !== 'track' || typeof track.uri !== 'string' || !track.uri.startsWith('spotify:track:')) return null;
            return {
                uri: track.uri,
                title: String(track.name ?? ''),
                artist: (track.artists ?? []).map((a: any) => a.name).join(', '),
                imageUrl: (album ?? track.album)?.images?.[0]?.url ?? null
            };
        };
        const tracks: SpotifyTrackItem[] = [];
        let name: string;
        let next: string | null;
        if (kind === 'album') {
            const album = await this.apiGet(`/albums/${id}`);
            name = album.name;
            tracks.push(...(album.tracks?.items ?? []).map((t: any) => item(t, album)));
            next = album.tracks?.next ?? null;
            while (next && tracks.length < MAX_LISTED_TRACKS) {
                const page = await this.apiGet(next);
                tracks.push(...(page.items ?? []).map((t: any) => item(t, album)));
                next = page.next ?? null;
            }
        } else {
            try {
                name = (await this.apiGet(`/playlists/${id}?fields=name`)).name;
            } catch (e) {
                // (Its editorial and generated playlists, which apps don't get to see)
                if (e instanceof SpotifyApiError && e.status === 404) throw new Error("Spotify won't list this playlist's tracks (it doesn't for its own playlists and mixes)");
                throw e;
            }
            next = `/playlists/${id}/items?limit=50&additional_types=track`;
            while (next && tracks.length < MAX_LISTED_TRACKS) {
                let page;
                try {
                    page = await this.apiGet(next);
                } catch (e) {
                    if (!(e instanceof SpotifyApiError) || e.status !== 403) throw e;
                    if (this.#grantedScopes && !this.#grantedScopes.includes('playlist-read-private')) {
                        throw new Error("Spotify needs linking again to list your playlists' tracks: open /api/spotify/auth on the device you linked it from");
                    }
                    throw new Error("Spotify only lists the tracks of playlists you own or collaborate on (save a copy to your account to pick from it)");
                }
                tracks.push(...(page.items ?? []).map((entry: any) => entry.is_local ? null : item(entry.item ?? entry.track)));
                next = page.next ?? null;
            }
        }
        const list = { at: Date.now(), name: String(name ?? ''), tracks: tracks.filter(t => t !== null) };
        this.#trackLists.set(contextUri, list);
        return list;
    }

    /** Has the music player fade out, as this starts playing. */
    private takeOver() {
        if (this.#handedOver) {
            this.#handedOver = false;
            this.changed();
        }
        getMusicHelperInstance().handOver(HANDOVER_FADE_MS);
    }

    // ---- Adaptive playlists ----

    /**
     * Starts an adaptive playlist on the current phase's list, carrying on with it if it's already loaded, and keeps it
     * following the phase from then on. The phase having no list means silence: the player fades out and pauses until a
     * phase with a list comes round.
     */
    private async playAdaptivePreset(presetId: string, device: string, fadeOutMs = FADE_MS, start: SpotifyStartTrack | null = null) {
        const preset = getSpotifyPresets().find(p => p.id === presetId);
        if (!preset || !isSpotifyAdaptivePreset(preset)) throw new Error('Unknown ambient adaptive playlist');
        // Picked, so it takes over even when it starts out silent
        this.takeOver();
        const key = getBOTCTClockInstanceManager().timeOfDay;
        this.#adaptivePresetId = presetId;
        this.#phaseKey = key;
        const uri = preset.phaseUris[key];
        if (uri === null) {
            this.#silenced = true;
            if (this.#playback?.playing) await this.fadeOutAndPause(device, fadeOutMs);
            else this.changed();
            return;
        }
        this.#silenced = false;
        if (isSameSpotifyContext(start?.contextUri, uri)) await this.playContext(uri, device, { fadeOutMs, startUri: start!.uri });
        else if (this.isLoadedContext(uri)) await this.resumeLoadedContext(device);
        else await this.playContext(uri, device, { fadeOutMs });
    }

    /**
     * When the games' phase changes, moves the volume to the new phase's time-of-day trim - as part of the adaptive
     * playlist's switch to the new phase's list, if there is one (fade out, switch, start at the new level), or
     * otherwise as a fade of its own.
     */
    private checkPhase() {
        const timeOfDay = getBOTCTClockInstanceManager().timeOfDay;
        // Updated first, so a switch started below comes in at the new phase's trim
        const phaseChanged = timeOfDay !== this.#trimTimeOfDay;
        this.#trimTimeOfDay = timeOfDay;
        // A preset scheduled for the phase change takes over from whatever was following the phase
        if (phaseChanged && this.#scheduledPresetId !== null) this.applyScheduledPreset();
        const switching = this.followSelectedPreset();
        // A switch starts the new playlist at the new phase's trim itself (see playContext)
        if (phaseChanged && !switching && !this.#switching) this.rampTrim();
    }

    /**
     * Switches to the preset scheduled for the phase change, fading over as the adaptive playlists do. Either preset kind:
     * an adaptive playlist starts on its list for the new phase, and follows the phase from then on.
     */
    private applyScheduledPreset() {
        const preset = getSpotifyPresets().find(p => p.id === this.#scheduledPresetId);
        const start = this.#scheduledStartTrack;
        this.setScheduledPreset(null);
        const deviceId = this.#hostDeviceId;
        if (!preset || deviceId === null) {
            this.changed();
            return;
        }
        console.log(`Spotify: phase changed, switching to the scheduled preset "${preset.name}"${start ? `, starting with "${start.title}"` : ''}`);
        this.takeOver();
        const device = `device_id=${encodeURIComponent(deviceId)}`;
        const fail = (e: unknown) => console.error('Failed to switch to the scheduled Spotify preset', e);
        if (isSpotifyAdaptivePreset(preset)) {
            this.playAdaptivePreset(preset.id, device, PHASE_SWITCH_FADE_MS, start).catch(fail);
        } else {
            this.clearAdaptivePreset();
            if (isSameSpotifyContext(start?.contextUri, preset.uri)) this.playContext(preset.uri, device, { fadeOutMs: PHASE_SWITCH_FADE_MS, startUri: start!.uri }).catch(fail);
            else if (this.isLoadedContext(preset.uri)) this.resumeLoadedContext(device).catch(fail);
            else this.playContext(preset.uri, device, { fadeOutMs: PHASE_SWITCH_FADE_MS }).catch(fail);
        }
    }

    /** Has the selected adaptive playlist follow a change of phase. Returns whether it started a switch. */
    private followSelectedPreset(): boolean {
        if (this.#adaptivePresetId === null) return false;
        const preset = this.adaptivePreset();
        if (!preset) {
            // Deleted in settings since it was started
            this.clearAdaptivePreset();
            this.changed();
            return false;
        }
        const key = getBOTCTClockInstanceManager().timeOfDay;
        if (key === this.#phaseKey) return false;
        this.#phaseKey = key;
        return this.followList(preset, key);
    }

    /**
     * Moves an adaptive playlist on to its list for the phase: fading out and pausing for a silent spell (a phase with
     * no list), and starting (or resuming) the list when one comes round. One paused by hand is left alone (starting it
     * again picks the list for then), as is one already on the right list. Returns whether it started a switch.
     */
    private followList(preset: SpotifyAdaptivePreset, key: TimeOfDay): boolean {
        const deviceId = this.#hostDeviceId;
        if (deviceId === null || this.#handedOver || (!this.#playback?.playing && !this.#silenced)) return false;
        const device = `device_id=${encodeURIComponent(deviceId)}`;
        const uri = preset.phaseUris[key];
        if (uri === null) {
            if (!this.#playback?.playing) return false;
            console.log(`Spotify: "${preset.name}" going silent for ${key}`);
            this.#silenced = true;
            this.fadeOutAndPause(device, PHASE_SWITCH_FADE_MS)
                .catch((e) => console.error('Failed to silence Spotify for the preset', e));
            return true;
        }
        this.#silenced = false;
        if (this.isLoadedContext(uri)) {
            if (this.#playback?.playing) return false;
            console.log(`Spotify: "${preset.name}" resuming for ${key}`);
            this.resumeAtCurrentLevel(device)
                .catch((e) => console.error('Failed to resume the preset', e));
            return true;
        }
        console.log(`Spotify: "${preset.name}" switching to its ${key} list, ${uri}`);
        this.playContext(uri, device, { fadeOutMs: PHASE_SWITCH_FADE_MS })
            .catch((e) => console.error('Failed to switch Spotify playlist for the new phase', e));
        return true;
    }

    /** Fades the player out and pauses it (an adaptive playlist's silent spell). Superseded by a newer switch. */
    private async fadeOutAndPause(device: string, fadeOutMs = FADE_MS) {
        const token = ++this.#fadeToken;
        this.stopTrimRamp();
        this.#switching = true;
        this.changed();
        try {
            if (!await this.fadeOut(device, token, fadeOutMs)) return;
            await this.api('PUT', `/me/player/pause?${device}`);
        } finally {
            // Left at 0 while paused; resuming brings the level back. (A switch this cut short leaves nothing pending.)
            if (token === this.#fadeToken) {
                this.#switching = false;
                this.#pendingContextUri = null;
                this.changed();
            }
        }
    }

    /** Resumes the loaded list, at the current phase's level (a silent spell left the player at 0). */
    private async resumeAtCurrentLevel(device: string) {
        this.stopTrimRamp();
        this.#trimDb = this.targetTrimDb();
        await this.setDeviceVolume(device, this.#volume);
        await this.api('PUT', `/me/player/play?${device}`);
        this.changed();
    }

    // ---- Audio dim ----

    private targetDimDb() {
        return this.#dimModel.dimmed ? -this.#dimModel.amountDb : 0;
    }

    /**
     * Fades from the current dim to the target, linear in dB, in step with the mixers' own dim fade. Only sends the
     * volume while nothing else is fading it: a trim ramp or playlist switch reads #dimDb as it goes, so carries it.
     */
    private async rampDim() {
        const token = ++this.#dimToken;
        const startDb = this.#dimDb;
        const start = Date.now();
        this.#dimRamping = true;
        try {
            for (; ;) {
                if (token !== this.#dimToken) return;
                const t = Math.min(1, (Date.now() - start) / DIM_FADE_MS);
                this.#dimDb = startDb + (this.targetDimDb() - startDb) * t;
                this.applyLevelChange('audio dim');
                if (t >= 1) return;
                await new Promise(resolve => setTimeout(resolve, FADE_STEP_MS));
            }
        } finally {
            if (token === this.#dimToken) this.#dimRamping = false;
        }
    }

    // ---- Time-of-day trim ----

    private targetTrimDb() {
        return getTimeOfDayTrimHelperInstance().model[this.#trimTimeOfDay];
    }

    /** Fades from the current trim to the current phase's, linear in dB. Superseded by a newer ramp or a playlist switch. */
    private async rampTrim() {
        const token = ++this.#trimToken;
        const startDb = this.#trimDb;
        const start = Date.now();
        this.#trimRamping = true;
        try {
            for (; ;) {
                if (token !== this.#trimToken) return;
                const t = Math.min(1, (Date.now() - start) / TRIM_FADE_MS);
                // The target is read as we go, so a knob turned mid-fade is followed
                const targetDb = this.targetTrimDb();
                this.#trimDb = startDb + (targetDb - startDb) * t;
                const deviceId = this.#hostDeviceId;
                if (deviceId !== null) {
                    await this.setDeviceVolume(`device_id=${encodeURIComponent(deviceId)}`, this.#volume)
                        .catch((e) => console.error('Failed to fade Spotify to the time-of-day trim', e));
                }
                if (t >= 1) return;
                await new Promise(resolve => setTimeout(resolve, FADE_STEP_MS));
            }
        } finally {
            if (token === this.#trimToken) this.#trimRamping = false;
        }
    }

    /** Stops a trim ramp where it is (a playlist switch takes over from there). */
    private stopTrimRamp() {
        this.#trimToken++;
        this.#trimRamping = false;
    }

    private adaptivePreset(): SpotifyAdaptivePreset | null {
        if (this.#adaptivePresetId === null) return null;
        const preset = getSpotifyPresets().find(p => p.id === this.#adaptivePresetId);
        return preset && isSpotifyAdaptivePreset(preset) ? preset : null;
    }

    private clearAdaptivePreset() {
        this.#adaptivePresetId = null;
        this.#phaseKey = null;
        this.#silenced = false;
    }

    // ---- Switching playlists ----

    /** Whether `uri` is the album/playlist already loaded in the player, or being switched to. */
    private isLoadedContext(uri: string) {
        return isSameSpotifyContext(this.#pendingContextUri ?? this.#playback?.contextUri, uri);
    }

    /**
     * Picking a preset whose album/playlist is already loaded: carries on with it rather than fading out and restarting
     * the same list. A switch already under way to it starts playback itself.
     */
    private async resumeLoadedContext(device: string) {
        if (!this.#switching && !this.#playback?.playing) {
            // A silent spell leaves the player at 0
            await this.setDeviceVolume(device, this.#volume);
            await this.api('PUT', `/me/player/play?${device}`);
        }
        this.changed();
    }

    /**
     * Switches to a new album/playlist: fades the old one out (over `fadeOutMs`), then starts the new one at full volume.
     * Spotify only has one active stream, so the two can't overlap. This is the only ramp while it runs: it takes over
     * from any time-of-day trim fade, and comes back in at the current phase's trim.
     * @param options.startUri A track of it to start with, the rest shuffled after it.
     */
    private async playContext(uri: string, device: string, options: { fadeOutMs?: number, startUri?: string } = {}) {
        const token = ++this.#fadeToken; // A newer request supersedes this one, including mid-fade
        const wasPlaying = this.#playback?.playing === true;
        const before = this.#playback;
        this.stopTrimRamp(); // The fade out carries on from wherever it had got to
        this.#pendingContextUri = uri;
        this.#switching = true;
        this.changed();
        try {
            if (wasPlaying && !await this.fadeOut(device, token, options.fadeOutMs ?? FADE_MS)) return;
            // Shuffle first, so playback of the new context starts on a random track - or, starting on a given track,
            // only once it's playing, so the shuffle can't pass it over to start somewhere else
            const startUri = options.startUri;
            await this.api('PUT', `/me/player/shuffle?state=${startUri ? 'false' : 'true'}&${device}`);
            // Superseded meanwhile (by a hand-over to the music player, say): don't start it after all
            if (token !== this.#fadeToken) return;
            await this.api('PUT', `/me/player/play?${device}`, { context_uri: uri, ...(startUri ? { offset: { uri: startUri } } : {}) });
            if (startUri) {
                if (!wasPlaying && token === this.#fadeToken) {
                    this.#trimDb = this.targetTrimDb();
                    await this.setDeviceVolume(device, this.#volume);
                }
                await this.waitForSwitch(uri, before, token);
                if (wasPlaying && token === this.#fadeToken) {
                    this.#trimDb = this.targetTrimDb();
                    await this.setDeviceVolume(device, this.#volume);
                }
                await this.api('PUT', `/me/player/shuffle?state=true&${device}`);
            } else if (wasPlaying) {
                // The play call returns before the player has actually switched, so restoring volume now would let the
                // old track blast back in. Wait until the player reports the new playlist (and a new track).
                await this.waitForSwitch(uri, before, token);
                if (token === this.#fadeToken) {
                    this.#trimDb = this.targetTrimDb();
                    await this.setDeviceVolume(device, this.#volume);
                }
            } else if (token === this.#fadeToken) {
                this.#trimDb = this.targetTrimDb();
                await this.setDeviceVolume(device, this.#volume);
            }
        } catch (e) {
            // Don't leave the player silent if we failed after fading out
            if (token === this.#fadeToken) {
                this.#trimDb = this.targetTrimDb();
                await this.setDeviceVolume(device, this.#volume).catch(() => { });
            }
            throw e;
        } finally {
            // A newer request has already set its own pending playlist, which is not ours to clear
            if (token === this.#fadeToken) {
                this.#switching = false;
                this.#pendingContextUri = null;
                this.changed();
            }
        }
    }

    /** Resolves once the host reports playback from `uri` on a different track than before, or after a timeout / when superseded. */
    private waitForSwitch(uri: string, before: SpotifyPlaybackModel | null, token: number) {
        const switched = () => {
            const now = this.#playback;
            if (!now || !isSameSpotifyContext(now.contextUri, uri)) return false;
            // Re-selecting the playing playlist keeps the context, so the track has to have changed too
            return !isSameSpotifyContext(before?.contextUri, uri) || now.title !== before?.title;
        };
        return new Promise<void>(resolve => {
            if (switched()) return resolve();
            const finish = () => {
                clearTimeout(timer);
                this.off('update', check);
                resolve();
            };
            const check = () => { if (switched() || token !== this.#fadeToken) finish(); };
            const timer = setTimeout(finish, SWITCH_TIMEOUT_MS);
            this.on('update', check);
        });
    }

    /**
     * Equal-power fade of the device volume from the chosen volume down to 0. Follows #volume as it goes, so a volume
     * change mid-fade is folded in rather than cutting across it. Returns false if superseded by a newer request.
     */
    private async fadeOut(device: string, token: number, durationMs: number) {
        const start = Date.now();
        for (; ;) {
            if (token !== this.#fadeToken) return false;
            const t = Math.min(1, (Date.now() - start) / durationMs);
            await this.setDeviceVolume(device, this.#volume * Math.cos(t * Math.PI / 2));
            if (t >= 1) return true;
            await new Promise(resolve => setTimeout(resolve, FADE_STEP_MS));
        }
    }

    /** Multiplier from the shared master fader, dim and current time-of-day trim, applied to every volume we send. */
    private levelFactor() {
        return getMixerMastersHelperInstance().model.mainGain * Math.pow(10, (this.#dimDb + this.#trimDb) / 20);
    }

    /**
     * Sets the host player's volume. Rather than through Spotify's Web API (a round trip to Spotify, rate limited), this
     * goes straight to the host over the mixer events stream, and its SDK player sets the volume locally (see
     * SpotifyPlayer) - quick and cheap enough for fine fade steps.
     * @param volume The level the user chose (0..100); the master gain, dim and trim are applied here so callers needn't think about them.
     */
    private async setDeviceVolume(_device: string, volume: number) {
        const hostClientId = this.#hostClientId;
        if (hostClientId === null) return;
        const effective = Math.min(1, Math.max(0, volume * this.levelFactor() / 100));
        if (effective === this.#deviceVolume) return;
        this.#deviceVolume = effective;
        this.emit('deviceVolume', hostClientId, effective);
    }

    /** The volume the host's player should currently be at, for a (re)connecting host to pick up. */
    get deviceVolume(): { hostClientId: string, volume: number } | null {
        if (this.#hostClientId === null || this.#deviceVolume === null) return null;
        return { hostClientId: this.#hostClientId, volume: this.#deviceVolume };
    }

    /** GETs from the Web API (a path, or a full URL such as a page's `next`), returning the JSON. Throws a SpotifyApiError. */
    private async apiGet(path: string): Promise<any> {
        const token = await this.getAccessToken();
        const url = path.startsWith('/') ? `https://api.spotify.com/v1${path}` : path;
        // (A page's `next`, which is only followed on the Web API, as it carries the token)
        if (!url.startsWith('https://api.spotify.com/')) throw new Error(`Not a Spotify API URL: ${url}`);
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new SpotifyApiError(res.status, `Spotify API GET ${path} failed: ${res.status} ${await res.text()}`);
        return await res.json();
    }

    private async api(method: string, path: string, body?: object) {
        const token = await this.getAccessToken();
        const res = await fetch(`https://api.spotify.com/v1${path}`, {
            method,
            headers: {
                'Authorization': `Bearer ${token}`,
                ...(body ? { 'Content-Type': 'application/json' } : {})
            },
            body: body ? JSON.stringify(body) : undefined
        });
        // 403 is Spotify's "already playing/paused" style restriction; the end state is what was asked for
        if (!res.ok && res.status !== 403) {
            // Not found, on the host's device: Spotify has forgotten the player
            const deviceId = new URLSearchParams(path.split('?')[1] ?? '').get('device_id');
            if (res.status === 404 && deviceId !== null && deviceId === this.#hostDeviceId) this.deviceLost();
            throw new Error(`Spotify API ${method} ${path} failed: ${res.status} ${await res.text()}`);
        }
    }
}

class SpotifyApiError extends Error {
    constructor(readonly status: number, message: string) {
        super(message);
    }
}

var instance: SpotifyHelper;

export function getSpotifyHelperInstance() {
    if (instance === undefined) {
        instance = new SpotifyHelper();
    }
    return instance;
}
