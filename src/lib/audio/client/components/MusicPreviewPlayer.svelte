<script lang="ts">
    import { untrack } from "svelte";
    import PlayIcon from "./PlayIcon.svelte";
    import PauseIcon from "./PauseIcon.svelte";
    import { formatMusicDuration } from "$lib/audio/common/musicLibrary";

    /**
     * Plays a music track through an <audio> element, which streams it (with Range requests) rather than decoding the
     * whole file up front as AudioPreviewPlayer does - fine for short loops, too slow and memory-hungry for songs.
     */
    let { url, onended }: { url: string | null, onended?: () => void } = $props();

    let audio: HTMLAudioElement | undefined = $state();
    let paused = $state(true);
    let currentTime = $state(0);
    let duration = $state(NaN);
    let loadError: string | null = $state(null);
    /** play() was asked for: carry on playing once the new url has loaded. */
    let wantPlaying = false;

    $effect(() => {
        const next = url;
        untrack(() => {
            loadError = null;
            currentTime = 0;
            if (!audio) return;
            if (next === null) {
                audio.removeAttribute('src');
                audio.load();
                wantPlaying = false;
                return;
            }
            audio.src = next;
            if (wantPlaying) start();
        });
    });

    function start() {
        audio?.play().catch((e) => {
            if (e?.name === 'AbortError') return; // Superseded by another track
            loadError = `Couldn't play: ${e?.message ?? e}`;
        });
    }

    /** Plays from the start of the current url (call from a user gesture, so audio is allowed). */
    export function play() {
        wantPlaying = true;
        if (audio && url !== null) {
            audio.currentTime = 0;
            start();
        }
    }

    /** Continue from the current position, or pause. */
    export function setPaused(value: boolean) {
        wantPlaying = !value;
        if (!audio || url === null) return;
        if (value) audio.pause();
        else start();
    }

    export function isPlaying(): boolean {
        return !paused;
    }

    function seekFromBar(e: MouseEvent) {
        if (!audio || !isFinite(duration)) return;
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        audio.currentTime = Math.min(Math.max(0, (e.clientX - rect.left) / rect.width), 1) * duration;
    }
</script>

<!-- svelte-ignore a11y_media_has_caption -->
<audio bind:this={audio} bind:paused bind:currentTime bind:duration preload="metadata"
    onended={() => { wantPlaying = false; onended?.(); }}
    onerror={() => { if (url !== null) loadError = "Couldn't load the track"; }}></audio>
<div class="preview-player">
    <!-- (Component names are the other way round: PlayIcon draws the pause bars, PauseIcon the triangle.) -->
    <button class="play" disabled={url === null} onclick={() => setPaused(!paused)} aria-label={paused ? 'Play' : 'Pause'} title={paused ? 'Play' : 'Pause'}>
        {#if paused}<PauseIcon size={14}/>{:else}<PlayIcon size={14}/>{/if}
    </button>
    <span class="time">{formatMusicDuration(currentTime)} / {isFinite(duration) ? formatMusicDuration(duration) : '-:--'}</span>
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="bar" class:disabled={!isFinite(duration)} onclick={seekFromBar}>
        <div class="fill" style:width="{isFinite(duration) && duration > 0 ? currentTime / duration * 100 : 0}%"></div>
    </div>
</div>
{#if loadError}<div class="error">{loadError}</div>{/if}

<style>
    .preview-player {
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
