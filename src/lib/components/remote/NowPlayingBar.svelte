<script lang="ts">
    import type { RemoteMusic } from "./remoteMusic.svelte";
    import MusicArt from "./MusicArt.svelte";

    /** The remote's now playing bar: what's playing and a skip button. Tapping it opens the music view. */
    let { music, onopen }: { music: RemoteMusic; onopen: () => void } = $props();

    const nowPlaying = $derived(music.nowPlaying);
    const nothingRunning = $derived(!music.musicAvailable && !music.spotifyAvailable);
</script>

<div class="now-playing-bar">
    <button class="info" onclick={onopen} title="Music controls">
        <MusicArt imageUrl={nowPlaying?.imageUrl ?? null} source={nowPlaying?.source ?? null} size={44}/>
        <span class="text">
            {#if nowPlaying}
            <span class="title">{nowPlaying.title}</span>
            <span class="subtitle">
                {#if !nowPlaying.playing}<span class="paused">Paused · </span>{/if}{nowPlaying.artist}
            </span>
            {:else}
            <span class="title">Nothing playing</span>
            <span class="subtitle">{nothingRunning ? 'No music player running' : 'Tap to pick a preset'}</span>
            {/if}
        </span>
    </button>
    <button class="skip" onclick={() => music.next()} disabled={!nowPlaying} title="Skip track" aria-label="Skip track">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
    </button>
</div>

<style>
    .now-playing-bar {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 6px;
        border-radius: 12px;
        background: rgba(40, 40, 44, 0.85);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.45);
        border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .info {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 0;
        border: none;
        background: none;
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
    }

    .text {
        min-width: 0;
        display: flex;
        flex-direction: column;
        line-height: 1.25;
    }

    .title, .subtitle {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .title {
        font-size: 0.85em;
        font-weight: 600;
    }

    .subtitle {
        font-size: 0.7em;
        opacity: 0.65;
    }

    .paused {
        font-weight: 600;
    }

    .skip {
        flex: none;
        width: 44px;
        height: 44px;
        display: flex;
        justify-content: center;
        align-items: center;
        border: none;
        border-radius: 50%;
        background: none;
        color: inherit;
        cursor: pointer;
    }

    .skip svg {
        width: 26px;
        height: 26px;
    }

    .skip:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.1);
    }

    .skip:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }
</style>
