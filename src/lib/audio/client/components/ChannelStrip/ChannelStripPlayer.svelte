<script lang="ts">
    import type { SpotifyPlayer } from "../../SpotifyPlayer.svelte";
    import type { MusicPlayer } from "../../MusicPlayer.svelte";
    import type { SpotifyPreset } from "$lib/audio/common/spotifyPreset";
    import type { MusicPreset } from "$lib/audio/common/musicPreset";
    import ChannelStripSpotify from "./ChannelStripSpotify.svelte";
    import ChannelStripMusic from "./ChannelStripMusic.svelte";
    import { selectedMusicSource } from "$lib/components/remote/remoteMusic.svelte";

    /**
     * The mixer's music strips: one for the Spotify player and one for the uploaded-music player, each while it's
     * running. The two can run side by side, though only one plays at a time - starting either (a preset, or play)
     * fades the other out, and a preset picked on one while the other plays is scheduled for the next phase change,
     * the same as within one player. A player that isn't running is an outline to start it from: with neither running,
     * one strip's worth split in two (Spotify only where it's set up on the server), and otherwise a narrow one beside
     * the strip that is.
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
    const error = $derived(spotify?.error ?? music?.error ?? null);
    /** Each strip's presets go by whether either player is playing, to schedule a pick rather than cut in. */
    const spotifyPlaying = $derived(spotifyRunning && spotify?.playback?.playing === true);
    const musicPlaying = $derived(musicRunning && music?.playing === true);
    /** Only the selected player's strip highlights its preset, as the remote shows it. */
    const selected = $derived(spotify && music ? selectedMusicSource(music, spotify) : spotify ? 'spotify' : 'music');
    /** Outlines for the players that aren't running (only those this client can start, or Spotify to link). */
    const spotifyOutline = $derived(!!spotify && offerSpotify && !spotifyRunning && (!spotifyModel?.authorized || spotify.canHost));
    const musicOutline = $derived(!!music && !musicRunning && music.canHost);
    const eitherRunning = $derived(spotifyRunning || musicRunning);
</script>

{#if spotify && spotifyRunning}
<ChannelStripSpotify {spotify} presets={spotifyPresets} otherPlaying={musicPlaying} selected={selected === 'spotify'} {style}/>
{/if}
{#if music && musicRunning}
<ChannelStripMusic {music} presets={musicPresets} otherPlaying={spotifyPlaying} selected={selected === 'music'} {style}/>
{/if}
{#if (spotify || music) && (!eitherRunning || spotifyOutline || musicOutline)}
<div class="player-slot" class:narrow={eitherRunning} {style}>
    {#if !spotifyOutline && !musicOutline}
        <div class="outline"><div class="outline-text">Player<br/>not<br/>running</div></div>
    {:else}
        <div class="outlines">
            {#if spotify && spotifyOutline}
                {#if !spotifyModel?.authorized}
                    <!-- The whole dashed area is the click target (not just the text), so it's easy to hit. -->
                    <a class="outline clickable" href="/api/spotify/auth" data-sveltekit-reload title="Link a Spotify account">
                        <div class="outline-text">+<br/>Link<br/>Spotify</div>
                    </a>
                {:else}
                    <button class="outline clickable" onclick={()=>spotify.startHosting()} disabled={spotify.starting} title="Start the Spotify player on this device">
                        <div class="outline-text">{#if spotify.starting}Starting…{:else}+<br/>Spotify{/if}</div>
                    </button>
                {/if}
            {/if}
            {#if music && musicOutline}
                <button class="outline clickable" onclick={()=>music.startHosting()} disabled={music.starting} title="Start the music player (your uploaded music) on this device">
                    <div class="outline-text">{#if music.starting}Starting…{:else}+<br/>Music{/if}</div>
                </button>
            {/if}
        </div>
    {/if}
    {#if !eitherRunning && error}<div class="error">{error}</div>{/if}
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

    /* Beside a running strip: just wide enough for the labels, stacked if both players' are there */
    .player-slot.narrow {
        width: 56px;
    }

    .outlines {
        flex: 1;
        display: flex;
        gap: 4px;
    }

    .narrow .outlines {
        flex-direction: column;
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
