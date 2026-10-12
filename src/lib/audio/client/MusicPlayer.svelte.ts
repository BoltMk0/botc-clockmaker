import { DEFAULT_MUSIC_GAIN, musicLevellingGainDb, type MusicControlAction, type MusicHostEvent, type MusicModel, type MusicTrackPlaybackModel } from "$lib/audio/common/model/musicModel";
import { subscribeMixerEvents } from "./MixerEventsClient";

const HEARTBEAT_MS = 5000;
const VOLUME_SEND_DELAY_MS = 80;
/** Brings the level back in when resuming after a fade-out, rather than snapping in. */
const FADE_IN_S = 0.05;
/** Time constant of the volume following the strip's fader. */
const VOLUME_TIME_CONSTANT_S = 0.05;
/** Points in the fades' equal-power curves. */
const FADE_CURVE_POINTS = 64;
/** Time constant of the loudness levelling easing to a new level mid-track (levelling switched, or the track measured). */
const LEVEL_TIME_CONSTANT_S = 0.5;

/** crypto.randomUUID is unavailable outside secure contexts (e.g. plain-http LAN access). */
function newClientId() {
    return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * One of the host's two players: an <audio> element and its own levelling and fade gains. Two, so that crossfading
 * can start the next track on one while the other fades out.
 */
type Deck = {
    audio: HTMLAudioElement;
    source: MediaElementAudioSourceNode;
    levelNode: GainNode;
    /** The levelling gain last set, so it's only moved when that changes. */
    levelGain: number;
    fadeNode: GainNode;
    /** The track it was loaded for (the model's loadId then), which what it reports is about. */
    loadId: number | null;
};

/** An equal-power curve from `from` down to silence (fading out) or from silence up to 1 (fading in). */
function fadeCurve(direction: 'out' | 'in', from = 1): Float32Array<ArrayBuffer> {
    const curve = new Float32Array(FADE_CURVE_POINTS);
    for (let i = 0; i < FADE_CURVE_POINTS; i++) {
        const angle = i / (FADE_CURVE_POINTS - 1) * Math.PI / 2;
        curve[i] = direction === 'out' ? from * Math.cos(angle) : Math.sin(angle);
    }
    return curve;
}

/**
 * Client side of the shared player for the uploaded music library. Exactly one client at a time hosts it (the sound
 * comes out of that device); every client, host included, sees the shared state over SSE and controls it through the
 * server, which decides what plays (see MusicHelper). The host follows the model: it plays through <audio> elements
 * routed into its mixer's Music & Ambience master bus, so the master fader, dim and time-of-day trim apply as they do
 * to the ambience, and does the fades itself on gain nodes. Loudness levelling is a further, hidden gain ahead of
 * that, set for each track as it starts. With crossfading on, the host tells the server when a track's nearly over,
 * and the next one starts on its other deck while the first fades out.
 */
export class MusicPlayer {
    readonly clientId = newClientId();
    /** Whether this client may run the player (false for remote-only clients, and ones with no mixer to play into). */
    readonly canHost: boolean;

    model = $state<MusicModel | null>(null);
    error = $state<string | null>(null);
    starting = $state(false);
    /** Meters what the host plays, after the strip's fader (null unless this client is the host). */
    analyser = $state.raw<AnalyserNode | null>(null);

    readonly #output: AudioNode | null;
    #unsubscribeEvents: () => void;
    #decks: [Deck, Deck] | null = null;
    /** Which deck is playing the model's track (the other is idle, or fading out the track before it). */
    #activeDeck = 0;
    #volumeNode: GainNode | null = null;
    #heartbeat: ReturnType<typeof setInterval> | null = null;
    #gainTimer: ReturnType<typeof setTimeout> | null = null;
    #pendingGain: number | null = null;
    /** The track and play state the host is on, or moving to (null before the first). */
    #targetLoadId: number | null = null;
    #targetPlaying = false;
    /** Bumped for every change of track or play state, so a fade from an older one gives up. */
    #transition = 0;
    /** The track the server's last been told is nearly over (to crossfade), so it's only told once. */
    #crossfadeReported: number | null = null;
    /** The browser refused to start playback without a gesture: try again at the next one. */
    #blocked = false;

    readonly #releaseOnLeave = () => { this.sendRelease(); };
    readonly #retryOnGesture = () => {
        if (!this.#blocked) return;
        this.#blocked = false;
        const deck = this.deck;
        if (this.#targetPlaying && deck) this.startElement(deck);
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
            if (wasHost && !this.isHost && this.#decks) this.teardown();
            else if (this.isHost && this.#decks) this.follow();
        });
    }

    get isHost() { return this.model !== null && this.model.hostClientId === this.clientId; }
    get active() { return this.model?.hostClientId != null; }
    get track(): MusicTrackPlaybackModel | null { return this.model?.track ?? null; }
    get playing() { return this.model?.playing === true && this.track !== null; }

    /** The loaded track, in the shape the now playing toast shows (as for Spotify). */
    /** The deck playing the model's track. */
    private get deck(): Deck | null { return this.#decks?.[this.#activeDeck] ?? null; }

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
            const volumeNode = context.createGain();
            volumeNode.gain.value = this.model?.gain ?? DEFAULT_MUSIC_GAIN;
            volumeNode.connect(this.#output);
            const analyser = context.createAnalyser();
            volumeNode.connect(analyser); // Side branch; the analyser has no output
            this.#decks = [this.createDeck(context, volumeNode), this.createDeck(context, volumeNode)];
            this.#activeDeck = 0;
            this.#volumeNode = volumeNode;
            this.analyser = analyser;
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

    private createDeck(context: AudioContext, into: AudioNode): Deck {
        const audio = new Audio();
        audio.preload = 'auto';
        const source = context.createMediaElementSource(audio);
        const levelNode = context.createGain();
        const fadeNode = context.createGain();
        source.connect(levelNode).connect(fadeNode).connect(into);
        const deck: Deck = { audio, source, levelNode, levelGain: 1, fadeNode, loadId: null };
        // Only the deck playing the model's track reports on it; one fading out has been moved on from
        audio.addEventListener('ended', () => { if (deck === this.deck) this.report('ended', deck.loadId); });
        audio.addEventListener('error', () => { if (deck === this.deck && audio.getAttribute('src')) this.report('error', deck.loadId); });
        audio.addEventListener('timeupdate', () => this.checkCrossfade(deck));
        return deck;
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
        for (const deck of this.#decks ?? []) {
            deck.audio.pause();
            deck.audio.removeAttribute('src');
            deck.audio.load();
            deck.source.disconnect();
            deck.levelNode.disconnect();
            deck.fadeNode.disconnect();
        }
        this.#volumeNode?.disconnect();
        this.analyser?.disconnect();
        this.#decks = null;
        this.#volumeNode = this.analyser = null;
        this.#targetLoadId = null;
        this.#targetPlaying = false;
        this.#crossfadeReported = null;
        this.#blocked = false;
    }

    private sendRelease() {
        // The server ignores this unless we're the host
        fetch('/api/music/host', { ...this.jsonInit('DELETE', { clientId: this.clientId }), keepalive: true }).catch(() => { });
    }

    /** Tells the server about a track it had us start: that it ended, wouldn't play, or is nearly over. */
    private report(event: MusicHostEvent, loadId: number | null) {
        if (loadId === null) return;
        this.put({ event, loadId }).catch(e => this.failHosting(e));
    }

    private async put(body: object) {
        const res = await fetch('/api/music/host', this.jsonInit('PUT', { clientId: this.clientId, ...body }));
        if (!res.ok) throw new Error(await this.errorMessage(res));
    }

    /** With crossfading on, tells the server once the playing track is within the crossfade of its end. */
    private checkCrossfade(deck: Deck) {
        const model = this.model;
        if (!model || !model.crossfade.enabled || !model.playing || deck !== this.deck || deck.loadId !== model.loadId) return;
        if (this.#crossfadeReported === deck.loadId || deck.audio.paused) return;
        const duration = deck.audio.duration;
        if (!isFinite(duration)) return;
        // A track shorter than two crossfades only gives up half of itself to each
        if (duration - deck.audio.currentTime > Math.min(model.crossfade.seconds, duration / 2)) return;
        this.#crossfadeReported = deck.loadId;
        this.report('crossfade', deck.loadId);
    }

    // ---- Following the model (host only) ----

    /** Brings the volume, track and play state in line with the model. A change already under way is left to finish. */
    private follow() {
        const model = this.model;
        const deck = this.deck, volumeNode = this.#volumeNode;
        if (!model || !deck || !volumeNode) return;
        volumeNode.gain.setTargetAtTime(model.gain, volumeNode.context.currentTime, VOLUME_TIME_CONSTANT_S);

        const track = model.track;
        const playing = model.playing && track !== null;
        if (track === null) {
            if (this.#targetLoadId !== null) {
                this.#transition++;
                this.#targetLoadId = null;
                this.#targetPlaying = false;
                for (const d of this.#decks ?? []) d.audio.pause();
            }
            return;
        }
        // Mid-track (not while fading over to the next one, which gets its own level as it starts)
        if (model.loadId === this.#targetLoadId) this.setLevel(LEVEL_TIME_CONSTANT_S);
        if (model.loadId === this.#targetLoadId && playing === this.#targetPlaying) return;
        const token = ++this.#transition;
        const audible = this.#targetPlaying && !deck.audio.paused;
        if (model.loadId !== this.#targetLoadId) {
            this.#targetLoadId = model.loadId;
            this.#targetPlaying = playing;
            if (model.crossfading && audible && playing) this.crossfadeTo(track.url, model.loadId, model.fadeMs);
            else this.switchTrack(track.url, model.loadId, playing, audible ? model.fadeMs : 0, token);
        } else {
            this.#targetPlaying = playing;
            if (playing) {
                this.setFade(deck, 1, FADE_IN_S);
                this.startElement(deck);
            } else {
                this.fadeOutAll(audible ? model.fadeMs : 0, token).then(done => { if (done) this.pauseAll(); });
            }
        }
    }

    /** Fades out what's playing (if anything), then starts the new track from the top - or just loads it, paused. */
    private async switchTrack(url: string, loadId: number, play: boolean, fadeMs: number, token: number) {
        if (!await this.fadeOutAll(fadeMs, token)) return;
        this.pauseAll();
        const deck = this.deck;
        if (!deck) return;
        this.load(deck, url, loadId);
        this.setLevel(0);
        this.setFade(deck, 1, 0);
        if (play) this.startElement(deck);
    }

    /**
     * Starts the new track on the other deck, fading it in as the playing one fades out (both on equal-power curves,
     * so the overall level holds steady). The fade is cut short to fit what's left of the playing track.
     */
    private crossfadeTo(url: string, loadId: number, fadeMs: number) {
        const decks = this.#decks;
        if (!decks) return;
        const from = decks[this.#activeDeck];
        this.#activeDeck = 1 - this.#activeDeck;
        const to = decks[this.#activeDeck];
        const remainingMs = (from.audio.duration - from.audio.currentTime) * 1000;
        const durationMs = Math.max(0, Math.min(fadeMs, isFinite(remainingMs) ? remainingMs : fadeMs));

        to.audio.pause();
        this.load(to, url, loadId);
        this.setLevel(0);
        this.scheduleCurve(to.fadeNode, durationMs > 0 ? fadeCurve('in') : null, durationMs);
        this.startElement(to);

        this.scheduleCurve(from.fadeNode, durationMs > 0 ? fadeCurve('out', from.fadeNode.gain.value) : null, durationMs);
        // Stopped once faded out, unless it's been put back to use since
        setTimeout(() => { if (from !== this.deck) from.audio.pause(); }, durationMs);
    }

    private load(deck: Deck, url: string, loadId: number) {
        deck.loadId = loadId;
        deck.audio.src = url;
    }

    private pauseAll() {
        for (const deck of this.#decks ?? []) deck.audio.pause();
    }

    private startElement(deck: Deck) {
        deck.audio.play().catch((e) => {
            if (e?.name === 'NotAllowedError') this.#blocked = true; // Waits for the next tap or click on the page
            else if (e?.name !== 'AbortError') console.error('MusicPlayer - failed to play', e); // (AbortError: superseded)
        });
    }

    /**
     * Equal-power fade from the current level to silence, of every deck that's playing (both, mid-crossfade). Resolves
     * false if superseded by a newer change.
     */
    private async fadeOutAll(durationMs: number, token: number): Promise<boolean> {
        for (const deck of this.#decks ?? []) {
            if (deck.audio.paused) continue;
            const gain = deck.fadeNode.gain.value;
            this.scheduleCurve(deck.fadeNode, durationMs > 0 ? fadeCurve('out', gain) : null, durationMs);
        }
        if (durationMs > 0) await new Promise(resolve => setTimeout(resolve, durationMs));
        return token === this.#transition;
    }

    /** Replaces whatever the fade node was doing with the curve (or, given none, silence at once). */
    private scheduleCurve(node: GainNode, curve: Float32Array<ArrayBuffer> | null, durationMs: number) {
        const param = node.gain;
        const now = node.context.currentTime;
        param.cancelScheduledValues(now);
        if (curve === null || durationMs <= 0) {
            param.setValueAtTime(curve === null ? 0 : curve[curve.length - 1], now);
            return;
        }
        param.setValueCurveAtTime(curve, now, durationMs / 1000);
    }

    /** Sets the active deck's levelling gain as the model calls for: straight away, or easing to it with the given time constant. */
    private setLevel(timeConstantS: number) {
        const deck = this.deck;
        if (!deck || !this.model) return;
        const gain = Math.pow(10, musicLevellingGainDb(this.model) / 20);
        if (timeConstantS > 0 && gain === deck.levelGain) return;
        deck.levelGain = gain;
        const now = deck.levelNode.context.currentTime;
        deck.levelNode.gain.cancelScheduledValues(now);
        if (timeConstantS <= 0) deck.levelNode.gain.setValueAtTime(gain, now);
        else deck.levelNode.gain.setTargetAtTime(gain, now, timeConstantS);
    }

    private setFade(deck: Deck, value: number, rampS: number) {
        const now = deck.fadeNode.context.currentTime;
        const param = deck.fadeNode.gain;
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

    /** @param gain Linear. Rapid calls (a fader drag) are coalesced. */
    setGain(gain: number) {
        this.#pendingGain = gain;
        if (this.model) this.model.gain = gain;
        if (this.#gainTimer !== null) return;
        this.#gainTimer = setTimeout(() => {
            this.#gainTimer = null;
            const v = this.#pendingGain;
            this.#pendingGain = null;
            if (v !== null) this.control({ action: 'gain', gain: v });
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
        if (this.isHost || this.#decks) this.stopHosting();
        if (this.#gainTimer !== null) clearTimeout(this.#gainTimer);
        this.#unsubscribeEvents();
    }
}
