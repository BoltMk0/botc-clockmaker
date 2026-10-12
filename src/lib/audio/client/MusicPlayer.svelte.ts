import { musicLevellingGainDb, type MusicControlAction, type MusicHostEvent, type MusicModel, type MusicTrackPlaybackModel } from "$lib/audio/common/model/musicModel";
import { subscribeMixerEvents } from "./MixerEventsClient";

const HEARTBEAT_MS = 5000;
const VOLUME_SEND_DELAY_MS = 80;
/** Brings the level back in when resuming after a fade-out, rather than snapping in. */
const FADE_IN_S = 0.05;
/** Time constant of the volume following the strip's fader. */
const VOLUME_TIME_CONSTANT_S = 0.05;
/** Points in the fade-out's equal-power curve. */
const FADE_CURVE_POINTS = 64;
/** Time constant of the loudness levelling easing to a new level mid-track (levelling switched, or the track measured). */
const LEVEL_TIME_CONSTANT_S = 0.5;

/** crypto.randomUUID is unavailable outside secure contexts (e.g. plain-http LAN access). */
function newClientId() {
    return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Client side of the shared player for the uploaded music library. Exactly one client at a time hosts it (the sound
 * comes out of that device); every client, host included, sees the shared state over SSE and controls it through the
 * server, which decides what plays (see MusicHelper). The host follows the model: it plays through an <audio> element
 * routed into its mixer's Music & Ambience master bus, so the master fader, dim and time-of-day trim apply as they do
 * to the ambience, and does the fades itself on a gain node. Loudness levelling is a further, hidden gain ahead of
 * that, set for each track as it starts.
 */
export class MusicPlayer {
    readonly clientId = newClientId();
    /** Whether this client may run the player (false for remote-only clients, and ones with no mixer to play into). */
    readonly canHost: boolean;

    model = $state<MusicModel | null>(null);
    error = $state<string | null>(null);
    starting = $state(false);

    readonly #output: AudioNode | null;
    #unsubscribeEvents: () => void;
    #audio: HTMLAudioElement | null = null;
    #source: MediaElementAudioSourceNode | null = null;
    #levelNode: GainNode | null = null;
    /** The levelling gain last set, so it's only moved when that changes. */
    #levelGain = 1;
    #fadeNode: GainNode | null = null;
    #volumeNode: GainNode | null = null;
    #heartbeat: ReturnType<typeof setInterval> | null = null;
    #volumeTimer: ReturnType<typeof setTimeout> | null = null;
    #pendingVolume: number | null = null;
    /** The track and play state the host is on, or moving to (null before the first). */
    #targetLoadId: number | null = null;
    #targetPlaying = false;
    /** Bumped for every change of track or play state, so a fade from an older one gives up. */
    #transition = 0;
    /** The browser refused to start playback without a gesture: try again at the next one. */
    #blocked = false;

    readonly #releaseOnLeave = () => { this.sendRelease(); };
    readonly #retryOnGesture = () => {
        if (!this.#blocked) return;
        this.#blocked = false;
        if (this.#targetPlaying) this.startElement();
    };

    /**
     * @param options.remoteOnly This client never runs the player itself; it can only control one running elsewhere.
     * @param options.output Where the host's sound goes: its mixer's Music & Ambience master bus input.
     */
    constructor(options: { remoteOnly?: boolean, output?: AudioNode | null } = {}) {
        this.#output = options.output ?? null;
        this.canHost = !(options.remoteOnly ?? false) && this.#output !== null;
        this.#unsubscribeEvents = subscribeMixerEvents((msg) => {
            if (msg.type !== 'musicUpdate') return;
            const wasHost = this.isHost;
            this.model = msg.model;
            // The server dropped our claim (e.g. we went quiet for too long): stop making sound.
            if (wasHost && !this.isHost && this.#audio) this.teardown();
            else if (this.isHost && this.#audio) this.follow();
        });
    }

    get isHost() { return this.model !== null && this.model.hostClientId === this.clientId; }
    get active() { return this.model?.hostClientId != null; }
    get track(): MusicTrackPlaybackModel | null { return this.model?.track ?? null; }
    get playing() { return this.model?.playing === true && this.track !== null; }

    /** The loaded track, in the shape the now playing toast shows (as for Spotify). */
    get playback() {
        const track = this.track;
        return track ? { playing: this.playing, title: track.title, artist: track.artist, imageUrl: track.imageUrl } : null;
    }

    // ---- Hosting ----

    /** Becomes the player host. Call from a click handler: browsers only allow audio to start after a gesture. */
    async startHosting() {
        if (!this.canHost || this.starting || this.isHost || !this.#output) return;
        this.starting = true;
        this.error = null;
        try {
            const claim = await fetch('/api/music/host', this.jsonInit('POST', { clientId: this.clientId }));
            if (!claim.ok) throw new Error(await this.errorMessage(claim));
            const context = this.#output.context as AudioContext;
            context.resume().catch(() => { });
            const audio = new Audio();
            audio.preload = 'auto';
            const source = context.createMediaElementSource(audio);
            const levelNode = context.createGain();
            this.#levelGain = 1;
            const fadeNode = context.createGain();
            const volumeNode = context.createGain();
            volumeNode.gain.value = (this.model?.volume ?? 50) / 100;
            source.connect(levelNode).connect(fadeNode).connect(volumeNode).connect(this.#output);
            audio.addEventListener('ended', () => this.report('ended'));
            audio.addEventListener('error', () => { if (audio.getAttribute('src')) this.report('error'); });
            this.#audio = audio;
            this.#source = source;
            this.#levelNode = levelNode;
            this.#fadeNode = fadeNode;
            this.#volumeNode = volumeNode;
            this.#heartbeat = setInterval(() => this.put({}).catch(e => this.failHosting(e)), HEARTBEAT_MS);
            window.addEventListener('pagehide', this.#releaseOnLeave);
            document.addEventListener('pointerdown', this.#retryOnGesture);
            this.follow();
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
        console.error('MusicPlayer - hosting failed', e);
        this.error = e instanceof Error ? e.message : String(e);
        this.stopHosting();
    }

    private teardown() {
        this.#transition++;
        if (this.#heartbeat) {
            clearInterval(this.#heartbeat);
            this.#heartbeat = null;
        }
        window.removeEventListener('pagehide', this.#releaseOnLeave);
        document.removeEventListener('pointerdown', this.#retryOnGesture);
        if (this.#audio) {
            this.#audio.pause();
            this.#audio.removeAttribute('src');
            this.#audio.load();
        }
        this.#source?.disconnect();
        this.#levelNode?.disconnect();
        this.#fadeNode?.disconnect();
        this.#volumeNode?.disconnect();
        this.#audio = this.#source = this.#levelNode = this.#fadeNode = this.#volumeNode = null;
        this.#targetLoadId = null;
        this.#targetPlaying = false;
        this.#blocked = false;
    }

    private sendRelease() {
        // The server ignores this unless we're the host
        fetch('/api/music/host', { ...this.jsonInit('DELETE', { clientId: this.clientId }), keepalive: true }).catch(() => { });
    }

    /** Tells the server the track it last had us start ended, or wouldn't play. */
    private report(event: MusicHostEvent) {
        if (this.#targetLoadId === null) return;
        this.put({ event, loadId: this.#targetLoadId }).catch(e => this.failHosting(e));
    }

    private async put(body: object) {
        const res = await fetch('/api/music/host', this.jsonInit('PUT', { clientId: this.clientId, ...body }));
        if (!res.ok) throw new Error(await this.errorMessage(res));
    }

    // ---- Following the model (host only) ----

    /** Brings the volume, track and play state in line with the model. A change already under way is left to finish. */
    private follow() {
        const model = this.model;
        const audio = this.#audio, fadeNode = this.#fadeNode, volumeNode = this.#volumeNode;
        if (!model || !audio || !fadeNode || !volumeNode) return;
        volumeNode.gain.setTargetAtTime(model.volume / 100, volumeNode.context.currentTime, VOLUME_TIME_CONSTANT_S);

        const track = model.track;
        const playing = model.playing && track !== null;
        if (track === null) {
            if (this.#targetLoadId !== null) {
                this.#transition++;
                this.#targetLoadId = null;
                this.#targetPlaying = false;
                audio.pause();
            }
            return;
        }
        // Mid-track (not while fading over to the next one, which gets its own level as it starts)
        if (model.loadId === this.#targetLoadId) this.setLevel(LEVEL_TIME_CONSTANT_S);
        if (model.loadId === this.#targetLoadId && playing === this.#targetPlaying) return;
        const token = ++this.#transition;
        const audible = this.#targetPlaying && !audio.paused;
        if (model.loadId !== this.#targetLoadId) {
            this.#targetLoadId = model.loadId;
            this.#targetPlaying = playing;
            this.switchTrack(track.url, playing, audible ? model.fadeMs : 0, token);
        } else {
            this.#targetPlaying = playing;
            if (playing) {
                this.setFade(1, FADE_IN_S);
                this.startElement();
            } else {
                this.fadeOut(audible ? model.fadeMs : 0, token).then(done => { if (done) audio.pause(); });
            }
        }
    }

    /** Fades out what's playing (if anything), then starts the new track from the top - or just loads it, paused. */
    private async switchTrack(url: string, play: boolean, fadeMs: number, token: number) {
        if (!await this.fadeOut(fadeMs, token)) return;
        const audio = this.#audio;
        if (!audio) return;
        audio.pause();
        audio.src = url;
        this.setLevel(0);
        this.setFade(1, 0);
        if (play) this.startElement();
    }

    private startElement() {
        this.#audio?.play().catch((e) => {
            if (e?.name === 'NotAllowedError') this.#blocked = true; // Waits for the next tap or click on the page
            else if (e?.name !== 'AbortError') console.error('MusicPlayer - failed to play', e); // (AbortError: superseded)
        });
    }

    /** Equal-power fade from the current level to silence. Resolves false if superseded by a newer change. */
    private async fadeOut(durationMs: number, token: number): Promise<boolean> {
        const node = this.#fadeNode;
        if (!node) return false;
        const param = node.gain;
        const now = node.context.currentTime;
        if (durationMs <= 0) {
            param.cancelScheduledValues(now);
            param.setValueAtTime(0, now);
            return token === this.#transition;
        }
        const from = param.value;
        const curve = new Float32Array(FADE_CURVE_POINTS);
        for (let i = 0; i < FADE_CURVE_POINTS; i++) curve[i] = from * Math.cos(i / (FADE_CURVE_POINTS - 1) * Math.PI / 2);
        param.cancelScheduledValues(now);
        param.setValueCurveAtTime(curve, now, durationMs / 1000);
        await new Promise(resolve => setTimeout(resolve, durationMs));
        return token === this.#transition;
    }

    /** Sets the levelling gain the model calls for: straight away, or easing to it with the given time constant. */
    private setLevel(timeConstantS: number) {
        const node = this.#levelNode;
        if (!node || !this.model) return;
        const gain = Math.pow(10, musicLevellingGainDb(this.model) / 20);
        if (timeConstantS > 0 && gain === this.#levelGain) return;
        this.#levelGain = gain;
        const now = node.context.currentTime;
        node.gain.cancelScheduledValues(now);
        if (timeConstantS <= 0) node.gain.setValueAtTime(gain, now);
        else node.gain.setTargetAtTime(gain, now, timeConstantS);
    }

    private setFade(value: number, rampS: number) {
        const node = this.#fadeNode;
        if (!node) return;
        const now = node.context.currentTime;
        const param = node.gain;
        const current = param.value;
        param.cancelScheduledValues(now);
        if (rampS <= 0) {
            param.setValueAtTime(value, now);
        } else {
            param.setValueAtTime(current, now);
            param.linearRampToValueAtTime(value, now + rampS);
        }
    }

    // ---- Remote control ----

    togglePlayPause() { this.control({ action: this.playing ? 'pause' : 'play' }); }
    next() { this.control({ action: 'next' }); }
    previous() { this.control({ action: 'previous' }); }
    /** Starts (or resumes) a preset straight away; adaptive and day & night presets then follow the phase. */
    playPreset(presetId: string) { this.control({ action: 'playPreset', presetId }); }
    /** Switches to a preset at the next change of the games' phase rather than now (null cancels). */
    schedulePreset(presetId: string | null) { this.control({ action: 'schedulePreset', presetId }); }

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

    private control(command: MusicControlAction) {
        this.error = null;
        fetch('/api/music/control', this.jsonInit('POST', command))
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
        if (this.isHost || this.#audio) this.stopHosting();
        if (this.#volumeTimer !== null) clearTimeout(this.#volumeTimer);
        this.#unsubscribeEvents();
    }
}
