import { EventEmitter } from "node:events";
import { env } from "$env/dynamic/private";
import type { SpotifyControlAction, SpotifyModel, SpotifyPlaybackModel } from "$lib/audio/common/model/spotifyModel";
import { DIM_FADE_MS, type AudioDimModel } from "$lib/audio/common/model/audioDimModel";
import { getAudioDimHelperInstance } from "../AudioDim/AudioDimHelper";
import { getTimeOfDayTrimHelperInstance } from "../TimeOfDayTrim/TimeOfDayTrimHelper";
import { adaptivePresetUriFor, isAdaptivePresetContext, isSameSpotifyContext, isSpotifyContextUri, isSpotifyAdaptivePreset, type SpotifyAdaptivePreset } from "$lib/audio/common/spotifyPreset";
import { JSONSingletonResourceManager } from "$lib/resources/server/jsonResourceManager";
import { getSpotifyPresets } from "$lib/resources/server/spotifyPresets";
import { getBOTCTClockInstanceManager } from "../model";
import type { TimeOfDay } from "$lib/model/client/types";

type SpotifyAuth = { refreshToken: string };

function isSpotifyAuth(value: unknown): value is SpotifyAuth {
    return typeof value === 'object' && value !== null && typeof (value as SpotifyAuth).refreshToken === 'string';
}

const AUTH_MANAGER = new JSONSingletonResourceManager<SpotifyAuth>('spotify_auth', isSpotifyAuth);

const SCOPES = ['streaming', 'user-read-email', 'user-read-private', 'user-modify-playback-state', 'user-read-playback-state'];
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
    /** The phase the adaptive playlist was last switched for. */
    #phaseTimeOfDay: TimeOfDay | null = null;
    /**
     * The shared time-of-day trim (on the Music & Ambience master) currently applied to every volume we send, in dB.
     * Applied here rather than by the mixers, so that it and a playlist switch's fades are one ramp, not two fighting.
     */
    #trimDb: number;
    /** The phase whose trim #trimDb is at, or ramping towards. */
    #trimTimeOfDay: TimeOfDay;
    #trimToken = 0;
    #trimRamping = false;
    /** The volume (0..1, dim and trim included) last sent to the host's player. */
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

        const phaseTimer = setInterval(() => this.checkPhase(), PHASE_CHECK_INTERVAL_MS);
        phaseTimer.unref?.();
    }

    /** Re-sends the volume after the dim or trim changes - unless a fade is under way, which applies it itself. */
    private applyLevelChange(what: string) {
        const deviceId = this.#hostDeviceId;
        if (deviceId === null || this.#switching || this.#trimRamping) return;
        this.setDeviceVolume(`device_id=${encodeURIComponent(deviceId)}`, this.#volume)
            .catch((e) => console.error(`Failed to apply ${what} to Spotify`, e));
    }

    #accessToken: string | null = null;
    #accessTokenExpiresAt = 0;

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
            adaptivePresetId: this.#adaptivePresetId
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

    private storeAccessToken(body: { access_token: string, expires_in: number }) {
        this.#accessToken = body.access_token;
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
        if (report.playback !== undefined) {
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
        // The SDK starts at the volume without the dim or trim
        this.#deviceVolume = null;
        await this.setDeviceVolume(`device_id=${encodeURIComponent(deviceId)}`, this.#volume);
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
                await this.api('PUT', `/me/player/play?${device}`);
                break;
            case 'pause':
                await this.api('PUT', `/me/player/pause?${device}`);
                break;
            case 'playContext':
                if (!isSpotifyContextUri(command.uri)) throw new Error('Invalid album/playlist');
                this.clearAdaptivePreset();
                await this.playContext(command.uri, device);
                break;
            case 'playAdaptivePreset':
                await this.playAdaptivePreset(command.presetId, device);
                break;
            case 'next':
                await this.api('POST', `/me/player/next?${device}`);
                break;
            case 'previous':
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

    // ---- Adaptive playlists ----

    /** Starts an adaptive playlist on the list for the current phase, and keeps it following the phase from then on. */
    private async playAdaptivePreset(presetId: string, device: string) {
        const preset = getSpotifyPresets().find(p => p.id === presetId);
        if (!preset || !isSpotifyAdaptivePreset(preset)) throw new Error('Unknown adaptive playlist');
        const timeOfDay = getBOTCTClockInstanceManager().timeOfDay;
        const ownUri = preset.phaseUris[timeOfDay];
        const current = this.#playback?.contextUri;
        // Already loaded (just paused) with this phase's list - or with any of its lists, if this phase has none to
        // switch to: carry on where it left off
        const resume = this.#adaptivePresetId === presetId && isAdaptivePresetContext(preset, current) &&
            (ownUri === null || isSameSpotifyContext(current, ownUri));
        const uri = ownUri ?? adaptivePresetUriFor(preset, timeOfDay);
        this.#adaptivePresetId = presetId;
        this.#phaseTimeOfDay = timeOfDay;
        if (resume) {
            await this.api('PUT', `/me/player/play?${device}`);
            this.changed();
        } else {
            await this.playContext(uri, device);
        }
    }

    /**
     * When the games' phase changes, moves the volume to the new phase's time-of-day trim - as part of the adaptive
     * playlist's switch to the new phase's list, if there is one (fade out, switch, start at the new level), or
     * otherwise as a fade of its own.
     */
    private checkPhase() {
        const timeOfDay = getBOTCTClockInstanceManager().timeOfDay;
        const switching = this.#adaptivePresetId !== null && timeOfDay !== this.#phaseTimeOfDay && this.followPhaseWithAdaptivePreset(timeOfDay);
        if (timeOfDay === this.#trimTimeOfDay) return;
        this.#trimTimeOfDay = timeOfDay;
        // A switch starts the new playlist at the new phase's trim itself (see playContext)
        if (!switching && !this.#switching) this.rampTrim();
    }

    /**
     * Switches a playing adaptive playlist over to its list for the new phase. Nothing changes if the new phase has no
     * list, or the same one as is already playing. Returns whether it started a switch.
     */
    private followPhaseWithAdaptivePreset(timeOfDay: TimeOfDay): boolean {
        this.#phaseTimeOfDay = timeOfDay;
        const preset = this.adaptivePreset();
        if (!preset) {
            // Deleted in settings since it was started
            this.clearAdaptivePreset();
            this.changed();
            return false;
        }
        // A paused preset is left alone; starting it again picks the new phase's list
        const deviceId = this.#hostDeviceId;
        if (deviceId === null || !this.#playback?.playing) return false;
        const uri = preset.phaseUris[timeOfDay];
        if (uri === null || isSameSpotifyContext(this.#pendingContextUri ?? this.#playback.contextUri, uri)) return false;
        console.log(`Spotify: phase changed to ${timeOfDay}, switching "${preset.name}" to ${uri}`);
        this.playContext(uri, `device_id=${encodeURIComponent(deviceId)}`, { fadeOutMs: PHASE_SWITCH_FADE_MS })
            .catch((e) => console.error('Failed to switch Spotify playlist for the new phase', e));
        return true;
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
        this.#phaseTimeOfDay = null;
    }

    // ---- Switching playlists ----

    /**
     * Switches to a new album/playlist: fades the old one out (over `fadeOutMs`), then starts the new one at full volume.
     * Spotify only has one active stream, so the two can't overlap. This is the only ramp while it runs: it takes over
     * from any time-of-day trim fade, and comes back in at the current phase's trim.
     */
    private async playContext(uri: string, device: string, options: { fadeOutMs?: number } = {}) {
        const token = ++this.#fadeToken; // A newer request supersedes this one, including mid-fade
        const wasPlaying = this.#playback?.playing === true;
        const before = this.#playback;
        this.stopTrimRamp(); // The fade out carries on from wherever it had got to
        this.#pendingContextUri = uri;
        this.#switching = true;
        this.changed();
        try {
            if (wasPlaying && !await this.fadeOut(device, token, options.fadeOutMs ?? FADE_MS)) return;
            // Shuffle first, so playback of the new context starts on a random track
            await this.api('PUT', `/me/player/shuffle?state=true&${device}`);
            await this.api('PUT', `/me/player/play?${device}`, { context_uri: uri });
            if (wasPlaying) {
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

    /** Multiplier from the shared dim and the current time-of-day trim, applied to every volume we send. */
    private levelFactor() {
        return Math.pow(10, (this.#dimDb + this.#trimDb) / 20);
    }

    /**
     * Sets the host player's volume. Rather than through Spotify's Web API (a round trip to Spotify, rate limited), this
     * goes straight to the host over the mixer events stream, and its SDK player sets the volume locally (see
     * SpotifyPlayer) - quick and cheap enough for fine fade steps.
     * @param volume The level the user chose (0..100); the dim and trim are applied here so callers needn't think about them.
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
            throw new Error(`Spotify API ${method} ${path} failed: ${res.status} ${await res.text()}`);
        }
    }
}

var instance: SpotifyHelper;

export function getSpotifyHelperInstance() {
    if (instance === undefined) {
        instance = new SpotifyHelper();
    }
    return instance;
}
