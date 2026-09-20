import { EventEmitter } from "node:events";
import { env } from "$env/dynamic/private";
import type { SpotifyControlAction, SpotifyModel, SpotifyPlaybackModel } from "$lib/audio/common/model/spotifyModel";
import { isSameSpotifyContext, isSpotifyContextUri } from "$lib/audio/common/spotifyPreset";
import { JSONSingletonResourceManager } from "$lib/resources/server/jsonResourceManager";

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
/** How long to wait for the player to report the new playlist before giving up and restoring volume anyway. */
const SWITCH_TIMEOUT_MS = 4000;
const FADE_STEP_MS = 100;
const HOST_CHECK_INTERVAL_MS = 5000;

export class SpotifyHelper extends EventEmitter {
    #hostClientId: string | null = null;
    #hostDeviceId: string | null = null;
    #hostLastSeen = 0;
    #hostCheckTimer: ReturnType<typeof setInterval> | null = null;
    #playback: SpotifyPlaybackModel | null = null;
    #volume = 50;
    #fadeToken = 0;

    #accessToken: string | null = null;
    #accessTokenExpiresAt = 0;

    on(eventName: 'update', listener: (model: SpotifyModel) => void): this;
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
            playback: this.#playback
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
            this.changed();
        }
    }

    /** The host's SDK player is registered with Spotify: make it the active playback device. */
    async hostReady(clientId: string, deviceId: string) {
        this.assertHost(clientId);
        this.#hostLastSeen = Date.now();
        this.#hostDeviceId = deviceId;
        await this.api('PUT', '/me/player', { device_ids: [deviceId], play: false });
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
                await this.playContext(command.uri, device);
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
                await this.api('PUT', `/me/player/volume?volume_percent=${volume}&${device}`);
                this.#volume = volume;
                this.changed();
                break;
            }
            default:
                throw new Error('Unknown action');
        }
    }

    /**
     * Switches to a new album/playlist: fades the old one out, then starts the new one at full volume.
     * Spotify only has one active stream, so the two can't overlap.
     */
    private async playContext(uri: string, device: string) {
        const token = ++this.#fadeToken; // A newer request supersedes this one, including mid-fade
        const target = this.#volume;
        const wasPlaying = this.#playback?.playing === true;
        const before = this.#playback;
        try {
            if (wasPlaying && !await this.fadeOut(device, target, token)) return;
            // Shuffle first, so playback of the new context starts on a random track
            await this.api('PUT', `/me/player/shuffle?state=true&${device}`);
            await this.api('PUT', `/me/player/play?${device}`, { context_uri: uri });
            if (wasPlaying) {
                // The play call returns before the player has actually switched, so restoring volume now would let the
                // old track blast back in. Wait until the player reports the new playlist (and a new track).
                await this.waitForSwitch(uri, before, token);
                if (token === this.#fadeToken) await this.setDeviceVolume(device, target);
            }
        } catch (e) {
            // Don't leave the player silent if we failed after fading out
            if (token === this.#fadeToken) await this.setDeviceVolume(device, target).catch(() => { });
            throw e;
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

    /** Equal-power fade of the device volume from target down to 0. Returns false if superseded by a newer request. */
    private async fadeOut(device: string, target: number, token: number) {
        const start = Date.now();
        for (; ;) {
            if (token !== this.#fadeToken) return false;
            const t = Math.min(1, (Date.now() - start) / FADE_MS);
            await this.setDeviceVolume(device, target * Math.cos(t * Math.PI / 2));
            if (t >= 1) return true;
            // Each API call takes a moment anyway; this just keeps us well inside Spotify's rate limits
            await new Promise(resolve => setTimeout(resolve, FADE_STEP_MS));
        }
    }

    private async setDeviceVolume(device: string, volume: number) {
        await this.api('PUT', `/me/player/volume?volume_percent=${Math.round(Math.min(100, Math.max(0, volume)))}&${device}`);
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
