<script lang="ts">
    import { onDestroy, untrack } from "svelte";
    import PlayIcon from "./PlayIcon.svelte";
    import PauseIcon from "./PauseIcon.svelte";

    /**
     * Previews a looping asset the way AudioAmbienceTrack plays it in-game: decoded into an AudioBuffer and looped
     * with an AudioBufferSourceNode, which is sample-accurate (unlike <audio loop>, which gaps when it seeks back).
     */
    let { url }: { url: string | null } = $props();

    /** play() starts this far before the end, so the loop's wrap-around is heard straight away. */
    const START_BEFORE_END_S = 2;

    let context: AudioContext | null = null;
    let buffer: AudioBuffer | null = $state(null);
    let source: AudioBufferSourceNode | null = null;
    let loadAbort: AbortController | null = null;
    let loadError: string | null = $state(null);

    let playing = $state(false);
    /** Buffer position (s) at the moment the current source was started, and the context time it started at. */
    let startOffset = 0;
    let startedAt = 0;
    let position = $state(0);
    let frame: number | null = null;
    /** play() was called before the buffer finished decoding, so start near the end once it has. */
    let startNearEndOnLoad = false;

    function getContext(): AudioContext {
        context ??= new AudioContext();
        return context;
    }

    $effect(() => {
        const next = url;
        untrack(() => load(next)); // Only the url should re-trigger a load, not the state load() touches
    });

    function load(url: string | null) {
        loadAbort?.abort();
        loadAbort = null;
        stopSource();
        buffer = null;
        loadError = null;
        startOffset = 0;
        position = 0;
        if (url === null) {
            setPlaying(false);
            return;
        }

        const abort = new AbortController();
        loadAbort = abort;
        fetch(url, { signal: abort.signal })
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.arrayBuffer();
            })
            .then((data) => getContext().decodeAudioData(data))
            .then((decoded) => {
                if (abort.signal.aborted) return; // Superseded by a later load while decoding
                loadAbort = null;
                buffer = decoded;
                if (startNearEndOnLoad) {
                    startNearEndOnLoad = false;
                    startOffset = position = nearEndOffset(decoded);
                }
                if (playing) startSource(startOffset);
            })
            .catch((e) => {
                if (abort.signal.aborted) return;
                loadError = `Couldn't load audio: ${e?.message ?? e}`;
                setPlaying(false);
            });
    }

    function startSource(offset: number) {
        if (buffer === null) return;
        stopSource();
        const ctx = getContext();
        const node = ctx.createBufferSource();
        node.buffer = buffer;
        node.loop = true;
        node.connect(ctx.destination);
        startOffset = offset;
        startedAt = ctx.currentTime;
        node.start(0, offset);
        source = node;
    }

    function stopSource() {
        if (source === null) return;
        startOffset = currentPosition();
        try { source.stop(); } catch { /* never started */ }
        source.disconnect();
        source = null;
    }

    function currentPosition(): number {
        if (buffer === null) return 0;
        if (source === null || context === null) return startOffset;
        return (startOffset + context.currentTime - startedAt) % buffer.duration;
    }

    function setPlaying(value: boolean) {
        playing = value;
        if (value) {
            getContext().resume().catch(() => {});
            if (source === null) startSource(startOffset);
            frame ??= requestAnimationFrame(tickPosition);
        } else {
            stopSource();
            position = startOffset;
        }
    }

    function tickPosition() {
        position = currentPosition();
        frame = playing ? requestAnimationFrame(tickPosition) : null;
    }

    function seek(offset: number) {
        if (buffer === null) return;
        startOffset = Math.min(Math.max(0, offset), buffer.duration);
        position = startOffset;
        if (playing) startSource(startOffset);
    }

    function seekFromBar(e: MouseEvent) {
        if (buffer === null) return;
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        seek((e.clientX - rect.left) / rect.width * buffer.duration);
    }

    function nearEndOffset(b: AudioBuffer): number {
        return Math.max(0, b.duration - START_BEFORE_END_S);
    }

    /**
     * Play from just before the end, so it wraps around the loop point straight away (call from a user gesture,
     * so audio is allowed). If still loading, starts once decoded.
     */
    export function play() {
        if (buffer === null) startNearEndOnLoad = true;
        else seek(nearEndOffset(buffer));
        setPlaying(true);
    }

    /** Continue from the current position, or pause. */
    export function setPaused(paused: boolean) {
        setPlaying(!paused);
    }

    export function isPlaying(): boolean {
        return playing;
    }

    function formatTime(s: number): string {
        const m = Math.floor(s / 60);
        return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
    }

    onDestroy(() => {
        loadAbort?.abort();
        if (frame !== null) cancelAnimationFrame(frame);
        stopSource();
        context?.close().catch(() => {});
    });
</script>

<div class="loop-player">
    <!-- (Component names are the other way round: PlayIcon draws the pause bars, PauseIcon the triangle.) -->
    <button class="play" disabled={url === null} onclick={() => setPlaying(!playing)} aria-label={playing ? 'Pause' : 'Play'} title={playing ? 'Pause' : 'Play'}>
        {#if playing}<PlayIcon size={14}/>{:else}<PauseIcon size={14}/>{/if}
    </button>
    <span class="time">{formatTime(position)} / {buffer ? formatTime(buffer.duration) : '-:--'}</span>
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="bar" class:disabled={buffer === null} onclick={seekFromBar}>
        <div class="fill" style:width="{buffer ? position / buffer.duration * 100 : 0}%"></div>
    </div>
</div>
{#if loadError}<div class="error">{loadError}</div>{/if}

<style>
    .loop-player {
        display: flex;
        align-items: center;
        gap: 0.6rem;
    }

    .play {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 2.2rem;
        height: 2.2rem;
        padding: 0;
        flex-shrink: 0;
    }

    .time {
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        color: var(--theme-on-bg-secondary);
    }

    .bar {
        flex: 1;
        min-width: 3rem;
        height: 0.5rem;
        border-radius: 0.25rem;
        background-color: var(--theme-bg-tertiary);
        cursor: pointer;
        overflow: hidden;
    }

    .bar.disabled {
        cursor: default;
    }

    .fill {
        height: 100%;
        background-color: var(--theme-slider-accent);
    }

    .error {
        color: var(--theme-error);
    }
</style>
