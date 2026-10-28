import type { SpotifyControlAction, SpotifyModel, SpotifyPlaybackModel } from "$lib/audio/common/model/spotifyModel";
import { subscribeMixerEvents } from "./MixerEventsClient";
import { PlayerAutoStart } from "./playerAutoStart";

const SDK_URL = 'https://sdk.scdn.co/spotify-player.js';
const HEARTBEAT_MS = 5000;
const VOLUME_SEND_DELAY_MS = 80;
const PLAYER_NAME = 'Clocktower Mixer';
/** Reconnecting the player after it drops off Spotify is given up on after this many tries within the window. */
const MAX_RECONNECTS = 3;
const RECONNECT_WINDOW_MS = 60000;

// Just the parts of the Spotify Web Playback SDK we use.
type SpotifySDKImage = { url: string, width?: number | null, height?: number | null };
type SpotifySDKTrack = { name: string, artists: { name: string }[], album?: { images?: SpotifySDKImage[] } };

/** Smallest album image that's still big enough to look sharp in the now playing toast (or the biggest there is). */
const ALBUM_ART_MIN_PX = 128;

function pickAlbumArt(images: SpotifySDKImage[] | undefined): string | null {
    if (!images || images.length === 0) return null;
    const sized = [...images].sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
    return (sized.find(i => (i.width ?? 0) >= ALBUM_ART_MIN_PX) ?? sized[sized.length - 1]).url;
}
type SpotifySDKState = { paused: boolean, context?: { uri: string | null }, track_window: { current_track: SpotifySDKTrack } };
type SpotifySDKPlayer = {
    connect(): Promise<boolean>;
    disconnect(): void;
    activateElement(): Promise<void>;
    setVolume(volume: number): Promise<void>;
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
    /** Whether this client may run the player (false for remote-only clients). */
    readonly canHost: boolean;

    model = $state<SpotifyModel | null>(null);
    error = $state<string | null>(null);
    starting = $state(false);

    #unsubscribeEvents: () => void;
    /**
     * Starts the player again when a page opens on this device, if it ran here last, with what it was playing: an
     * adaptive preset, or an album/playlist (a plain preset's, or any other).
     */
    readonly #autoStart: PlayerAutoStart<{ adaptivePresetId: string } | { contextUri: string }>;
    #player: SpotifySDKPlayer | null = null;
    #heartbeat: ReturnType<typeof setInterval> | null = null;
    #volumeTimer: ReturnType<typeof setTimeout> | null = null;
    #pendingVolume: number | null = null;
    /** The volume (0..1) the server last told this client's player to be at, while hosting. */
    #deviceVolume: number | null = null;
    /** Bumped on every start/stop, so a start that was abandoned partway doesn't complete. */
    #generation = 0;
    /** The device our player last registered with Spotify as, while it's still registered. */
    #deviceId: string | null = null;
    /** When the player was last reconnected, within the window. */
    #reconnects: number[] = [];

    readonly #releaseOnLeave = () => { this.sendRelease(); };
    /** A player started without a gesture (by itself, as this device ran it last time) may only make sound after one. */
    readonly #activateOnGesture = () => { this.#player?.activateElement().catch(() => { }); };

    /** @param options.remoteOnly This client never runs the player itself; it can only control one running elsewhere. */
    constructor(options: { remoteOnly?: boolean } = {}) {
        this.canHost = !(options.remoteOnly ?? false);
        this.#autoStart = new PlayerAutoStart('spotify', this.canHost);
        this.#unsubscribeEvents = subscribeMixerEvents((msg) => {
            if (msg.type === 'spotifyDeviceVolume') {
                // The server runs the volume (fades, dim, trim), but this client's player applies it, locally
                if (msg.hostClientId !== this.clientId) return;
                this.#deviceVolume = msg.volume;
                this.#player?.setVolume(msg.volume).catch((e) => console.error('SpotifyPlayer - failed to set volume', e));
                return;
            }
            if (msg.type !== 'spotifyUpdate') return;
            const wasHost = this.isHost;
            this.model = msg.model;
            // The server dropped our claim (e.g. we went quiet for too long): stop making sound.
            if (wasHost && !this.isHost && this.#player) this.teardown();
            // Spotify has forgotten our player (the server found it gone): connect it again
            else if (this.isHost && !msg.model.hostReady && this.#deviceId !== null) this.reconnect();
            // This device ran the player last time: run it again, once Spotify's set up and no other device runs it
            else if (this.#autoStart.shouldStart(msg.model.configured && msg.model.authorized && msg.model.hostClientId === null)) this.startHosting();
            // Once the player can take commands: play again what it was playing, or else note what's playing now
            if (this.isHost && msg.model.hostReady) {
                const restore = this.#autoStart.takeRestore();
                if (restore && 'adaptivePresetId' in restore) this.playAdaptivePreset(restore.adaptivePresetId);
                else if (restore) this.playContext(restore.contextUri);
                else this.#autoStart.rememberPlaying(this.nowPlaying(msg.model));
            }
        });
    }

    /** What the player's playing, as it's remembered to play again: an adaptive preset (quiet for a phase still counts), or an album/playlist. */
    private nowPlaying(model: SpotifyModel): { adaptivePresetId: string } | { contextUri: string } | null {
        if (model.adaptivePresetId !== null) {
            return model.playback?.playing || model.adaptivePresetSilent ? { adaptivePresetId: model.adaptivePresetId } : null;
        }
        return model.playback?.playing && model.playback.contextUri ? { contextUri: model.playback.contextUri } : null;
    }

    get isHost() { return this.model !== null && this.model.hostClientId === this.clientId; }
    get hostedElsewhere() { return this.model?.hostClientId != null && !this.isHost; }
    get playback(): SpotifyPlaybackModel | null { return this.model?.playback ?? null; }

    // ---- Hosting ----

    /**
     * Becomes the player host. Call from a click handler: browsers only allow the player to start audio after a gesture
     * (started without one, it's let at the next). This device then starts it again by itself whenever a page that can opens.
     */
    async startHosting() {
        if (!this.canHost || this.starting || this.isHost) return;
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
                volume: this.#deviceVolume ?? (this.model?.volume ?? 50) / 100,
                getOAuthToken: (cb) => {
                    fetch('/api/spotify/token', this.jsonInit('POST', { clientId: this.clientId }))
                        .then(res => res.ok ? res.json() : Promise.reject(new Error(`token request failed: ${res.status}`)))
                        .then(body => cb(body.token))
                        .catch(e => this.failHosting(e));
                }
            });
            this.#player = player;
            player.addListener('ready', ({ device_id }: { device_id: string }) => {
                this.#deviceId = device_id;
                this.put({ deviceId: device_id }).catch(e => this.failHosting(e));
            });
            // Dropped off Spotify (a network blip, say): nothing can play on it until it's connected again
            player.addListener('not_ready', ({ device_id }: { device_id: string }) => {
                if (device_id !== this.#deviceId) return;
                this.put({ deviceId: null }).catch(e => this.failHosting(e));
                this.reconnect();
            });
            player.addListener('player_state_changed', (state: SpotifySDKState | null) => {
                this.put({ playback: state ? this.toPlayback(state) : null }).catch(e => this.failHosting(e));
            });
            for (const event of ['initialization_error', 'authentication_error', 'account_error']) {
                player.addListener(event, ({ message }: { message: string }) => this.failHosting(new Error(message)));
            }
            // Must happen while we still count as handling the user's click. Without one (started by itself), the
            // browser may refuse, and the next touch of the page activates it instead.
            await player.activateElement().catch(() => { });
            if (!await player.connect()) throw new Error('Could not connect to Spotify');

            this.#heartbeat = setInterval(() => {
                this.put({}).catch(e => this.failHosting(e));
            }, HEARTBEAT_MS);
            window.addEventListener('pagehide', this.#releaseOnLeave);
            document.addEventListener('pointerdown', this.#activateOnGesture, { once: true });
            this.#autoStart.remember(true);
        } catch (e) {
            this.failHosting(e);
        } finally {
            this.starting = false;
        }
    }

    /** Stops the local player and gives the host role up so another client can take it, and this device no longer starts it by itself. */
    stopHosting() {
        this.#autoStart.remember(false);
        this.release();
    }

    /** Stops the local player and gives the host role up, still starting it again next time (e.g. leaving the page). */
    private release() {
        this.teardown();
        this.sendRelease();
    }

    /** Connects the player to Spotify again, as a new device (which it reports once ready), giving up if it keeps dropping off. */
    private async reconnect() {
        const player = this.#player;
        if (!player || this.#deviceId === null) return;
        this.#deviceId = null;
        const now = Date.now();
        this.#reconnects = this.#reconnects.filter(t => now - t < RECONNECT_WINDOW_MS);
        if (this.#reconnects.length >= MAX_RECONNECTS) return this.failHosting(new Error('The Spotify player keeps dropping off Spotify'));
        this.#reconnects.push(now);
        console.warn('SpotifyPlayer - the player dropped off Spotify, reconnecting');
        player.disconnect();
        const connected = await player.connect().catch(() => false);
        if (!connected && player === this.#player) this.failHosting(new Error('Could not reconnect to Spotify'));
    }

    private failHosting(e: unknown) {
        console.error('SpotifyPlayer - hosting failed', e);
        this.error = e instanceof Error ? e.message : String(e);
        this.release();
    }

    private teardown() {
        this.#generation++;
        if (this.#heartbeat) {
            clearInterval(this.#heartbeat);
            this.#heartbeat = null;
        }
        window.removeEventListener('pagehide', this.#releaseOnLeave);
        document.removeEventListener('pointerdown', this.#activateOnGesture);
        this.#player?.disconnect();
        this.#player = null;
        this.#deviceVolume = null;
        this.#deviceId = null;
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
            imageUrl: pickAlbumArt(track?.album?.images),
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
    /** Starts (or resumes) an adaptive playlist on the list for the current phase; it then follows the phase. */
    playAdaptivePreset(presetId: string) { this.control({ action: 'playAdaptivePreset', presetId }); }
    /** Switches to a preset at the next change of the games' phase rather than now (null cancels). */
    schedulePreset(presetId: string | null) { this.control({ action: 'schedulePreset', presetId }); }
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
        if (this.isHost || this.#player) this.release();
        if (this.#volumeTimer !== null) clearTimeout(this.#volumeTimer);
        this.#unsubscribeEvents();
    }
}
