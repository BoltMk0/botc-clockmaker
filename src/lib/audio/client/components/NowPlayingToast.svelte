<script lang="ts">
    import { fly } from "svelte/transition";
    import { cubicIn, cubicOut } from "svelte/easing";
    import { untrack } from "svelte";
    import type { SpotifyPlayer } from "../SpotifyPlayer.svelte";
    import type { SpotifyPlaybackModel } from "$lib/audio/common/model/spotifyModel";
    import Marquee from "./Marquee.svelte";
    import { appSettings } from "$lib/model/client/appSettings.svelte";

    /** How long the popup stays up. */
    const SHOW_MS = 6000;

    let { spotify }: { spotify: SpotifyPlayer | null } = $props();

    type Shown = { key: string, title: string, artist: string, imageUrl: string | null };

    function toShown(playback: SpotifyPlaybackModel): Shown {
        return { key: `${playback.title}\n${playback.artist}`, title: playback.title, artist: playback.artist, imageUrl: playback.imageUrl ?? null };
    }

    /** The popup, in "popup" mode. */
    let popup = $state<Shown | null>(null);
    /** Album art that failed to load, so it's left out rather than shown broken. */
    let failedImageUrl = $state<string | null>(null);
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    /** The track last reported; undefined until the first report, which never pops up (it was already playing when the page opened). */
    let lastKey: string | undefined = undefined;
    let lastPlaying = false;

    function hidePopup() {
        popup = null;
        if (hideTimer !== null) { clearTimeout(hideTimer); hideTimer = null; }
    }

    $effect(() => {
        const playback = spotify?.playback;
        if (!playback) return;
        const key = toShown(playback).key;
        if (lastKey === undefined) { lastKey = key; lastPlaying = playback.playing; return; }
        // Pausing takes it down; resuming (or a new track starting) brings it back up
        if (!playback.playing) { lastPlaying = false; hidePopup(); return; }
        const changed = key !== lastKey || !lastPlaying;
        lastKey = key;
        lastPlaying = true;
        if (!changed || !playback.title) return;
        if (untrack(() => appSettings.nowPlayingMode) !== 'popup') return;
        popup = toShown(playback);
        if (hideTimer !== null) clearTimeout(hideTimer);
        hideTimer = setTimeout(hidePopup, SHOW_MS);
    });

    // Switching away from "popup" takes one that's up down
    $effect(() => { if (appSettings.nowPlayingMode !== 'popup') untrack(hidePopup); });

    $effect(() => hidePopup);

    /** In "on" mode, the track for as long as it's playing. */
    const shown = $derived.by((): Shown | null => {
        switch (appSettings.nowPlayingMode) {
            case 'popup': return popup;
            case 'on': {
                const playback = spotify?.playback;
                return playback?.playing && playback.title ? toShown(playback) : null;
            }
            default: return null;
        }
    });

    const position = $derived(appSettings.nowPlayingPosition);
    /** Drops in from above at the top of the screen, rises up from below at the bottom. */
    const flyY = $derived(position.startsWith('top') ? -24 : 24);
</script>

{#if shown}
{#key shown.key}
<!-- |global: the toast sits inside {#key} inside {#if}, and a plain (local) transition only plays when its own block
     comes or goes - so showing or hiding it through the {#if} would just pop it in and out. -->
<div class="now-playing-toast {position}" role="status"
    in:fly|global={{ y: flyY, opacity: 0, duration: 450, easing: cubicOut }}
    out:fly|global={{ y: flyY, opacity: 0, duration: 350, easing: cubicIn }}>
    {#if shown.imageUrl && shown.imageUrl !== failedImageUrl}
    <img src={shown.imageUrl} alt="" onerror={() => failedImageUrl = shown?.imageUrl ?? null}/>
    {/if}
    <div class="text">
        <div class="label">Now playing</div>
        <div class="title"><Marquee text={shown.title}/></div>
        <div class="artist"><Marquee text={shown.artist}/></div>
    </div>
</div>
{/key}
{/if}

<style>
    .now-playing-toast {
        position: fixed;
        /* Above the display and QR codes, below the side menu's overlays */
        z-index: 900;
        display: flex;
        align-items: center;
        gap: 12px;
        /* A fixed width, so it doesn't change size from track to track; text too long for it scrolls (see Marquee) */
        width: min(300px, calc(100vw - 32px));
        box-sizing: border-box;
        padding: 8px 18px 8px 8px;
        border-radius: 12px;
        background-color: rgb(50, 50, 54);
        border: 3px solid var(--theme-slider-trim);
        box-shadow: 0 6px 14px #000b;
        color: white;
        pointer-events: none;
    }

    .top, .top-right { top: 16px; }
    .bottom, .bottom-left, .bottom-right { bottom: 16px; }
    .top, .bottom {
        left: 50%;
        transform: translateX(-50%);
    }
    .bottom-left { left: 16px; }
    .top-right, .bottom-right { right: 16px; }

    img {
        width: 64px;
        height: 64px;
        border-radius: 6px;
        object-fit: cover;
        flex-shrink: 0;
    }

    .text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .label {
        color: #999;
        font-size: 0.7em;
        font-weight: bold;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    .title {
        font-weight: bold;
        font-size: 1.1em;
    }

    .artist {
        color: #ccc;
    }
</style>
