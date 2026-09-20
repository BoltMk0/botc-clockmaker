import type { SpotifyControlAction, SpotifyModel, SpotifyPlaybackModel } from "$lib/audio/common/model/spotifyModel";
import { SSEClient } from "../../model/client/util/sseClient.svelte";

const SDK_URL = 'https://sdk.scdn.co/spotify-player.js';
const HEARTBEAT_MS = 5000;
const VOLUME_SEND_DELAY_MS = 80;
const PLAYER_NAME = 'Clocktower Mixer';

// Just the parts of the Spotify Web Playback SDK we use.
type SpotifySDKTrack = { name: string, artists: { name: string }[] };
type SpotifySDKState = { paused: boolean, context?: { uri: string | null }, track_window: { current_track: SpotifySDKTrack } };
type SpotifySDKPlayer = {
    connect(): Promise<boolean>;
    disconnect(): void;
    activateElement(): Promise<void>;
    addListener(event: string, cb: (arg: any) => void): boolean;
};
type SpotifySDK = {
    Player: new (options: { name: string, getOAuthToken: (cb: (token: string) => void) => void, volume?: number }) => SpotifySDKPlayer;
};

let sdkPromise: Promise<SpotifySDK> | null = null;

function loadSdk(): Promise<SpotifySDK> {
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise<SpotifySDK>((resolve, reject) => {
        (window as any).onSpotifyWebPlaybackSDKReady = () => resolve((window as any).Spotify);
        const script = document.createElement('script');
        script.src = SDK_URL;
        script.async = true;
        script.onerror = () => {
            sdkPromise = null;
            reject(new Error('Could not load the Spotify player script'));
        };
        document.head.appendChild(script);
    });
    return sdkPromise;
}

/** crypto.randomUUID is unavailable outside secure contexts (e.g. plain-http LAN access). */
function newClientId() {
    return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Client side of the shared Spotify player. Exactly one client at a time "hosts" the Web Playback SDK
 * instance (the sound comes out of that device); every client, host included, sees the shared state
 * over SSE and controls playback through the server.
 */
export class SpotifyPlayer {
    readonly clientId = newClientId();

    model = $state<SpotifyModel | null>(null);
    error = $state<string | null>(null);
    starting = $state(false);

    #sse: SSEClient;
    #player: SpotifySDKPlayer | null = null;
    #heartbeat: ReturnType<typeof setInterval> | null = null;
    #volumeTimer: ReturnType<typeof setTimeout> | null = null;
    #pendingVolume: number | null = null;
    /** Bumped on every start/stop, so a start that was abandoned partway doesn't complete. */
    #generation = 0;

    readonly #releaseOnLeave = () => { this.sendRelease(); };

    constructor() {
        this.#sse = new SSEClient('/api/spotify/events', (msg) => {
            if (msg.type !== 'spotifyUpdate') return;
            const wasHost = this.isHost;
            this.model = msg.model;
            // The server dropped our claim (e.g. we went quiet for too long): stop making sound.
            if (wasHost && !this.isHost && this.#player) this.teardown();
        });
    }

    get isHost() { return this.model !== null && this.model.hostClientId === this.clientId; }
    get hostedElsewhere() { return this.model?.hostClientId != null && !this.isHost; }
    get playback(): SpotifyPlaybackModel | null { return this.model?.playback ?? null; }

    // ---- Hosting ----

    /** Becomes the player host. Call from a click handler: browsers only allow the player to start audio after a gesture. */
    async startHosting() {
        if (this.starting || this.isHost) return;
        this.starting = true;
        this.error = null;
        const generation = ++this.#generation;
        try {
            const claim = await fetch('/api/spotify/host', this.jsonInit('POST', { clientId: this.clientId }));
            if (!claim.ok) throw new Error(await this.errorMessage(claim));
            const Spotify = await loadSdk();
            if (generation !== this.#generation) return;

            const player = new Spotify.Player({
                name: PLAYER_NAME,
                volume: (this.model?.volume ?? 50) / 100,
                getOAuthToken: (cb) => {
                    fetch('/api/spotify/token', this.jsonInit('POST', { clientId: this.clientId }))
                        .then(res => res.ok ? res.json() : Promise.reject(new Error(`token request failed: ${res.status}`)))
                        .then(body => cb(body.token))
                        .catch(e => this.failHosting(e));
                }
            });
            this.#player = player;
            player.addListener('ready', ({ device_id }: { device_id: string }) => {
                this.put({ deviceId: device_id }).catch(e => this.failHosting(e));
            });
            player.addListener('player_state_changed', (state: SpotifySDKState | null) => {
                this.put({ playback: state ? this.toPlayback(state) : null }).catch(e => this.failHosting(e));
            });
            for (const event of ['initialization_error', 'authentication_error', 'account_error']) {
                player.addListener(event, ({ message }: { message: string }) => this.failHosting(new Error(message)));
            }
            // Must happen while we still count as handling the user's click
            await player.activateElement();
            if (!await player.connect()) throw new Error('Could not connect to Spotify');

            this.#heartbeat = setInterval(() => {
                this.put({}).catch(e => this.failHosting(e));
            }, HEARTBEAT_MS);
            window.addEventListener('pagehide', this.#releaseOnLeave);
        } catch (e) {
            this.failHosting(e);
        } finally {
            this.starting = false;
        }
    }

    /** Stops the local player and gives the host role up so another client can take it. */
    stopHosting() {
        this.teardown();
        this.sendRelease();
    }

    private failHosting(e: unknown) {
        console.error('SpotifyPlayer - hosting failed', e);
        this.error = e instanceof Error ? e.message : String(e);
        this.stopHosting();
    }

    private teardown() {
        this.#generation++;
        if (this.#heartbeat) {
            clearInterval(this.#heartbeat);
            this.#heartbeat = null;
        }
        window.removeEventListener('pagehide', this.#releaseOnLeave);
        this.#player?.disconnect();
        this.#player = null;
    }

    private sendRelease() {
        // The server ignores this unless we're the host
        fetch('/api/spotify/host', { ...this.jsonInit('DELETE', { clientId: this.clientId }), keepalive: true }).catch(() => { });
    }

    private toPlayback(state: SpotifySDKState): SpotifyPlaybackModel {
        const track = state.track_window.current_track;
        return {
            playing: !state.paused,
            title: track?.name ?? '',
            artist: track?.artists?.map(a => a.name).join(', ') ?? '',
            contextUri: state.context?.uri ?? null
        };
    }

    private async put(body: object) {
        const res = await fetch('/api/spotify/host', this.jsonInit('PUT', { clientId: this.clientId, ...body }));
        if (!res.ok) throw new Error(await this.errorMessage(res));
    }

    // ---- Remote control ----

    togglePlayPause() { this.control({ action: this.playback?.playing ? 'pause' : 'play' }); }
    next() { this.control({ action: 'next' }); }
    /** Starts playing an album/playlist straight away. */
    playContext(uri: string) { this.control({ action: 'playContext', uri }); }
    previous() { this.control({ action: 'previous' }); }

    /** @param volume 0..100. Rapid calls (a slider drag) are coalesced. */
    setVolume(volume: number) {
        this.#pendingVolume = volume;
        if (this.model) this.model.volume = volume;
        if (this.#volumeTimer !== null) return;
        this.#volumeTimer = setTimeout(() => {
            this.#volumeTimer = null;
            const v = this.#pendingVolume;
            this.#pendingVolume = null;
            if (v !== null) this.control({ action: 'volume', volume: v });
        }, VOLUME_SEND_DELAY_MS);
    }

    private control(command: SpotifyControlAction) {
        this.error = null;
        fetch('/api/spotify/control', this.jsonInit('POST', command))
            .then(async (res) => { if (!res.ok) this.error = await this.errorMessage(res); })
            .catch((e) => { this.error = e instanceof Error ? e.message : String(e); });
    }

    // ---- Helpers ----

    private jsonInit(method: string, body: object): RequestInit {
        return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
    }

    private async errorMessage(res: Response) {
        const body = await res.json().catch(() => null);
        return body?.message ?? `Request failed (${res.status})`;
    }

    close() {
        if (this.isHost || this.#player) this.stopHosting();
        if (this.#volumeTimer !== null) clearTimeout(this.#volumeTimer);
        this.#sse.close();
    }
}
