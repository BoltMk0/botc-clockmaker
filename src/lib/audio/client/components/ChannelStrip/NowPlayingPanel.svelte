<script lang="ts" module>
    export type PlaybackState = 'playing' | 'paused' | 'silent' | 'idle';
</script>

<script lang="ts">
    import { ICON_VIEWBOX, musicNoteFillIcon, pauseFillIcon, stopFillIcon, volumeOffFillIcon } from "$lib/icons/material.js";
    import TimeOfDayIcon from "$lib/assets/timeOfDayIcon.svelte";
    import type { TimeOfDay } from "$lib/model/client/types";
    import Marquee from "../Marquee.svelte";
    import { progressPositionMs, type PlaybackProgressModel } from "$lib/audio/common/model/playbackProgress";
    import { mixerServerNow } from "../../MixerEventsClient";

    const LINE_PX = 14; // Keep in step with .track line-height

    /**
     * A music strip's now playing panel, filling the strip's spare height over the album artwork: the preset loaded on
     * top, the track in the middle (clamped to however many lines fit) with the player's state and how far through it
     * is under it, and the preset being switched to, or waiting for the next phase, along the bottom - in the pending colour, filled or outlined, as the
     * presets are everywhere else. Clicking it opens the music controls.
     */
    let {
        playback,
        presetName = null,
        /** For an adaptive preset, the phases whose playlist is loaded. */
        phases = [],
        track = null,
        /** How far through the track the player is, as its host last said. */
        progress = null,
        imageUrl = null,
        emptyText,
        /** The preset being switched to, while what was playing fades out. */
        pendingName = null,
        /** The preset waiting for the next phase change. */
        nextName = null,
        onclick
    }: {
        playback: PlaybackState;
        presetName?: string | null;
        phases?: TimeOfDay[];
        track?: { title: string; artist: string } | null;
        progress?: PlaybackProgressModel | null;
        imageUrl?: string | null;
        emptyText: string;
        pendingName?: string | null;
        nextName?: string | null;
        onclick: () => void;
    } = $props();

    const STATE_LABELS: Record<PlaybackState, string> = { playing: 'Playing', paused: 'Paused', silent: 'Silent this phase', idle: 'Stopped' };

    // The position, counted on from the host's last report while it's running (by the server's clock, which it's stamped with)
    const PROGRESS_TICK_MS = 250;
    let serverNow = $state(mixerServerNow());
    $effect(() => {
        if (!progress?.running) return;
        serverNow = mixerServerNow();
        const timer = setInterval(() => serverNow = mixerServerNow(), PROGRESS_TICK_MS);
        return () => clearInterval(timer);
    });
    const shownProgress = $derived(track && progress ? progress : null);
    const positionMs = $derived(shownProgress ? progressPositionMs(shownProgress, serverNow) : 0);
    const fraction = $derived(shownProgress && shownProgress.durationMs > 0 ? positionMs / shownProgress.durationMs : 0);

    function formatTime(ms: number) {
        const seconds = Math.floor(ms / 1000);
        return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    }

    let trackHeight = $state(0);
    const lines = $derived(Math.max(1, Math.floor(trackHeight / LINE_PX)));

    const tooltip = $derived([
        `${STATE_LABELS[playback]}${presetName ? `: ${presetName}` : ''}`,
        ...(track ? [`${track.title} - ${track.artist}`] : []),
        ...(shownProgress && shownProgress.durationMs > 0 ? [`${formatTime(positionMs)} / ${formatTime(shownProgress.durationMs)}`] : []),
        ...(pendingName ? [`Loading ${pendingName}`] : nextName ? [`Next phase: ${nextName}`] : []),
        'Click for the music controls'
    ].join('\n'));
</script>

<button class="now-playing" class:has-art={!!imageUrl} style:background-image={imageUrl ? `url("${imageUrl}")` : undefined}
    {onclick} title={tooltip} aria-haspopup="dialog">
    <span class="status" class:dim={!presetName}>
        <svg class="status-icon" viewBox={ICON_VIEWBOX} fill="currentColor" aria-hidden="true"><path d={musicNoteFillIcon}/></svg>
        <span class="status-name">{#if presetName}<Marquee text={presetName}/>{:else}No preset{/if}</span>
        {#each phases as phase (phase)}<TimeOfDayIcon timeOfDay={phase} size={10}/>{/each}
    </span>
    <span class="track" bind:clientHeight={trackHeight}>
        <span class="track-text" style:-webkit-line-clamp={lines}>
            {#if track}<strong>{track.title}</strong><br/>{track.artist}{:else}{emptyText}{/if}
        </span>
    </span>
    <!-- The player's state, and how far through the track it is (once its host has said) -->
    <span class="progress" class:dim={playback === 'idle' || playback === 'silent'}>
        <span class="state-icon" aria-label={STATE_LABELS[playback]}>
            {#if playback === 'playing'}
            <span class="bars"><i></i><i></i><i></i></span>
            {:else if playback === 'paused'}
            <svg viewBox={ICON_VIEWBOX} fill="currentColor"><path d={pauseFillIcon}/></svg>
            {:else if playback === 'silent'}
            <svg viewBox={ICON_VIEWBOX} fill="currentColor"><path d={volumeOffFillIcon}/></svg>
            {:else}
            <svg viewBox={ICON_VIEWBOX} fill="currentColor"><path d={stopFillIcon}/></svg>
            {/if}
        </span>
        {#if shownProgress && playback !== 'silent'}
        <span class="time">{formatTime(positionMs)}</span>
        <span class="bar" role="progressbar" aria-label="Track progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fraction * 100)}>
            <span class="bar-fill" class:running={shownProgress.running} style:transform="scaleX({fraction})"></span>
        </span>
        <span class="time">{shownProgress.durationMs > 0 ? formatTime(shownProgress.durationMs) : '–:––'}</span>
        {:else}
        <span class="state-label">{STATE_LABELS[playback]}</span>
        {/if}
    </span>
    {#if pendingName}
    <span class="upcoming pending"><span class="upcoming-label">Loading</span><span class="upcoming-name"><Marquee text={pendingName}/></span></span>
    {:else if nextName}
    <span class="upcoming"><span class="upcoming-label">Next</span><span class="upcoming-name"><Marquee text={nextName}/></span></span>
    {/if}
</button>

<style>
    .now-playing {
        flex: 1;
        min-height: 84px;
        display: flex;
        flex-direction: column;
        gap: 3px;
        margin: 2px 0 6px;
        padding: 0;
        overflow: hidden;
        border: 2px solid transparent;
        border-radius: 5px;
        background-color: #0003;
        background-size: cover;
        background-position: center;
        /* Inside the border only, where the darkening shadow reaches (it would show bright under the transparent border) */
        background-origin: padding-box;
        background-clip: padding-box;
        color: #ccc;
        font: inherit;
        text-align: center;
        cursor: pointer;
        transition: border-color 0.15s;
    }

    .now-playing:hover, .now-playing:focus-visible {
        border-color: var(--theme-slider-accent);
        outline: none;
    }

    /* Over the artwork: darkened behind everything, so it stays readable */
    .now-playing.has-art {
        background-color: transparent;
        box-shadow: inset 0 0 0 999px #000a;
        color: #eee;
    }

    .status {
        flex: none;
        display: flex;
        align-items: center;
        gap: 3px;
        padding: 3px 4px;
        background: #0006;
        font-size: 10px;
        font-weight: bold;
        line-height: 12px;
        color: var(--theme-slider-accent);
    }

    .status.dim {
        color: #999;
        font-weight: normal;
    }

    .status-icon {
        width: 10px;
        height: 10px;
    }

    .state-icon {
        flex: none;
        display: flex;
        width: 10px;
        height: 10px;
    }

    .state-icon svg {
        width: 10px;
        height: 10px;
    }

    /* Too long to fit, it scrolls (see Marquee) */
    .status-name {
        flex: 1;
        min-width: 0;
        text-align: left;
        white-space: nowrap;
    }

    .status :global(svg) {
        flex: none;
    }

    .track {
        flex: 1;
        min-height: 28px; /* at least two lines */
        overflow: hidden;
        padding: 0 3px;
        /* The text (clamped to the lines that fit) sits in the middle of the space between the bars, both ways */
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .track-text {
        max-width: 100%;
    }

    .track-text {
        font-size: 11px;
        line-height: 14px; /* keep in step with LINE_PX */
        word-break: break-word;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    /* The preset to come: outlined in the pending colour while it waits, filled while it loads */
    .upcoming {
        flex: none;
        display: flex;
        align-items: baseline;
        gap: 4px;
        margin: 0 3px 3px;
        padding: 2px 4px;
        border-radius: 3px;
        box-shadow: inset 0 0 0 1.5px #fc6;
        background: #0008;
        color: #fc6;
        font-size: 10px;
        line-height: 12px;
    }

    .upcoming.pending {
        background: #fc6;
        color: #222;
    }

    .upcoming-label {
        flex: none;
        font-size: 8px;
        font-weight: bold;
        text-transform: uppercase;
    }

    .upcoming-name {
        flex: 1;
        min-width: 0;
        text-align: left;
        font-weight: bold;
        white-space: nowrap;
    }

    /* The state, then the time gone, a bar, and the track's length */
    .progress {
        flex: none;
        display: flex;
        align-items: center;
        gap: 3px;
        margin: 0 4px;
        font-size: 9px;
        line-height: 12px;
        color: var(--theme-slider-accent);
    }

    .progress.dim {
        color: #999;
    }

    .time {
        flex: none;
        font-variant-numeric: tabular-nums;
        color: #ddd;
    }

    .state-label {
        flex: 1;
        text-align: left;
        font-weight: bold;
    }

    .bar {
        flex: 1;
        min-width: 12px;
        height: 3px;
        overflow: hidden;
        border-radius: 2px;
        background: #fff3;
    }

    .bar-fill {
        display: block;
        height: 100%;
        background: currentColor;
        transform-origin: left;
    }

    /* Moving on smoothly between the ticks while it plays */
    .bar-fill.running {
        transition: transform 0.25s linear;
    }

    /* A small equaliser while it plays */
    .bars {
        display: flex;
        align-items: flex-end;
        gap: 1px;
        width: 10px;
        height: 10px;
    }

    .bars i {
        flex: 1;
        background: currentColor;
        animation: bar 0.9s ease-in-out infinite alternate;
    }

    .bars i:nth-child(2) { animation-delay: -0.3s; }
    .bars i:nth-child(3) { animation-delay: -0.6s; }

    @keyframes bar {
        from { height: 2px; }
        to { height: 10px; }
    }

    @media (prefers-reduced-motion: reduce) {
        .bars i { animation: none; height: 7px; }
    }
</style>
