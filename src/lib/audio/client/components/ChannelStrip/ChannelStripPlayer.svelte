<script lang="ts">
    import type { SpotifyPlayer } from "../../SpotifyPlayer.svelte";
    import type { MusicPlayer } from "../../MusicPlayer.svelte";
    import type { SpotifyPreset } from "$lib/audio/common/spotifyPreset";
    import type { MusicPreset } from "$lib/audio/common/musicPreset";
    import ChannelStripSpotify from "./ChannelStripSpotify.svelte";
    import ChannelStripMusic from "./ChannelStripMusic.svelte";

    /**
     * The mixer's music strip, which the Spotify player and the uploaded-music player share: whichever is running takes
     * it (the server only lets one run at a time). With neither running, it's an empty outline to start one from - split
     * in two, Spotify and music, where Spotify is set up on the server.
     */
    let {
        spotify = undefined,
        music = undefined,
        spotifyPresets = [],
        musicPresets = [],
        style = undefined
    }: {
        spotify?: SpotifyPlayer;
        music?: MusicPlayer;
        spotifyPresets?: SpotifyPreset[];
        musicPresets?: MusicPreset[];
        style?: string;
    } = $props();

    const spotifyModel = $derived(spotify?.model ?? null);
    const spotifyRunning = $derived(spotifyModel?.configured === true && spotifyModel.hostClientId !== null);
    const musicRunning = $derived(music?.active === true);
    /** Spotify gets half the outline once the server says it's set up. */
    const offerSpotify = $derived(spotifyModel?.configured === true);
    /** Whether this client can start either player (not a remote-only one). */
    const canStart = $derived((music?.canHost ?? false) || (offerSpotify && (spotify?.canHost ?? false)));
    const error = $derived(spotify?.error ?? music?.error ?? null);
</script>

{#if spotify && spotifyRunning}
<ChannelStripSpotify {spotify} presets={spotifyPresets} {style}/>
{:else if music && musicRunning}
<ChannelStripMusic {music} presets={musicPresets} {style}/>
{:else if spotify || music}
<div class="player-slot" {style}>
    {#if !canStart && !(offerSpotify && !spotifyModel?.authorized)}
        <div class="outline"><div class="outline-text">Player<br/>not<br/>running</div></div>
    {:else}
        <div class="outlines">
            {#if spotify && offerSpotify}
                {#if !spotifyModel?.authorized}
                    <!-- The whole dashed area is the click target (not just the text), so it's easy to hit. -->
                    <a class="outline clickable" href="/api/spotify/auth" data-sveltekit-reload title="Link a Spotify account">
                        <div class="outline-text">+<br/>Link<br/>Spotify</div>
                    </a>
                {:else if spotify.canHost}
                    <button class="outline clickable" onclick={()=>spotify.startHosting()} disabled={spotify.starting || music?.starting} title="Start the Spotify player on this device">
                        <div class="outline-text">{#if spotify.starting}Starting…{:else}+<br/>Spotify{/if}</div>
                    </button>
                {/if}
            {/if}
            {#if music?.canHost}
                <button class="outline clickable" onclick={()=>music.startHosting()} disabled={music.starting || spotify?.starting} title="Start the music player (your uploaded music) on this device">
                    <div class="outline-text">{#if music.starting}Starting…{:else}+<br/>Music{/if}</div>
                </button>
            {/if}
        </div>
    {/if}
    {#if error}<div class="error">{error}</div>{/if}
</div>
{/if}

<style>
    /* The same footprint as a running Spotify/music strip: 110px wide inside 6px padding and a 4px border. */
    .player-slot {
        width: 130px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-family: 'Courier New', Courier, monospace;
    }

    .outlines {
        flex: 1;
        display: flex;
        gap: 4px;
    }

    .outline {
        flex: 1;
        min-width: 0;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: stretch;
        padding: 0;
        background-color: transparent;
        border: 4px dashed #777;
        border-radius: 8px;
        /* Resets for when this is a <button>/<a> (the clickable cases) rather than a plain <div>. */
        font: inherit;
        text-align: inherit;
        text-decoration: none;
        color: inherit;
        cursor: default;
    }

    /* Two side by side: thinner borders, so the labels still fit */
    .outlines .outline + .outline, .outlines .outline:has(+ .outline) {
        border-width: 3px;
    }

    .outline.clickable {
        cursor: pointer;
    }

    .outline.clickable:hover:not(:disabled) {
        border-color: #aaa;
    }

    .outline:disabled {
        cursor: default;
        opacity: 0.7;
    }

    .outline-text {
        text-align: center;
        color: #999;
        font-weight: bold;
        font-size: 0.8em;
        padding: 8px 0;
    }

    .outline.clickable .outline-text {
        color: #ccc;
    }

    .error {
        font-size: 0.65em;
        color: #f88;
        text-align: center;
        word-break: break-word;
    }
</style>
