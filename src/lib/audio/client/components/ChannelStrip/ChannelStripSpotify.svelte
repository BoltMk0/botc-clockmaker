<script lang="ts">
    import AudioMixerText from "./AudioMixerText.svelte";
    import VSlider from "../VSlider.svelte";
    import PlayIcon from "../PlayIcon.svelte";
    import PauseIcon from "../PauseIcon.svelte";
    import type { SpotifyPlayer } from "../../SpotifyPlayer.svelte";

    let {
        spotify,
        style = undefined
    }: {
        spotify: SpotifyPlayer;
        style?: string;
    } = $props();

    const model = $derived(spotify.model);
    const active = $derived(model !== null && model.hostClientId !== null);
    let menuOpen = $state(false);
</script>

<svelte:window
    onpointerdown={(ev)=>{ if(menuOpen && !(ev.target as Element).closest?.('.spotify-strip')) menuOpen = false; }}
    onkeydown={(ev)=>{ if(ev.key === 'Escape') menuOpen = false; }}
/>

{#if model?.configured}
{#if active}
<div class="channel-strip-main spotify-strip" style={style}>
    <AudioMixerText onclick={()=>menuOpen = !menuOpen} style="margin-bottom: 5px;" title={spotify.isHost ? 'Playing from this device. Click for controls' : 'Playing from another device. Click for controls'}>Spotify</AudioMixerText>
    {#if menuOpen}
    <div class="popup">
        <div class="transport">
            <AudioMixerText onclick={()=>spotify.previous()} title="Previous track">&#9198;</AudioMixerText>
            <AudioMixerText onclick={()=>spotify.togglePlayPause()} title={spotify.playback?.playing ? 'Pause' : 'Play'}>
                {#if spotify.playback?.playing}<PauseIcon/>{:else}<PlayIcon/>{/if}
            </AudioMixerText>
            <AudioMixerText onclick={()=>spotify.next()} title="Next track">&#9197;</AudioMixerText>
        </div>
        {#if spotify.isHost}
        <AudioMixerText onclick={()=>{ menuOpen = false; spotify.stopHosting(); }} title="Stop the player on this device so another can take over">Stop player</AudioMixerText>
        {:else}
        <div class="remote-note">Playing from another device</div>
        {/if}
    </div>
    {/if}
    <div class="now-playing" title={spotify.playback ? `${spotify.playback.title} - ${spotify.playback.artist}` : ''}>
        {#if !model.hostReady}
            Starting…
        {:else if spotify.playback}
            <strong>{spotify.playback.title}</strong><br/>{spotify.playback.artist}
        {:else}
            Nothing playing.<br/>Pick "Clocktower Mixer" in Spotify.
        {/if}
    </div>
    <div class="channel-strip-padding"></div>
    <AudioMixerText>Vol<br/>{Math.round(model.volume)}%</AudioMixerText>
    <div class="volume">
        <VSlider value={model.volume} min={0} max={100} step={1} onchange={(v)=>spotify.setVolume(v)}/>
    </div>
    {#if spotify.error}<div class="error">{spotify.error}</div>{/if}
</div>
{:else}
<div class="channel-strip-main empty" style={style}>
    {#if !model.authorized}
        <a class="empty-action" href="/api/spotify/auth" data-sveltekit-reload>+<br/>Link<br/>Spotify</a>
    {:else}
        <button class="empty-action" onclick={()=>spotify.startHosting()} disabled={spotify.starting}>
            {#if spotify.starting}Starting…{:else}+<br/>Spotify<br/>player{/if}
        </button>
    {/if}
    {#if spotify.error}<div class="error">{spotify.error}</div>{/if}
</div>
{/if}
{/if}

<style>
    .channel-strip-main {
        width: 85px;
        box-sizing: content-box;
        background-color: rgb(50, 50, 54);
        padding: 6px;
        border: 4px solid var(--theme-slider-trim);
        border-radius: 8px;
        box-shadow: 0 0 10px #0006 inset, 0px 4px 8px 0px #0009;
        display: flex;
        flex-direction: column;
        font-family: 'Courier New', Courier, monospace;
        color: #ccc;
    }

    .channel-strip-main.empty {
        background-color: transparent;
        border: 4px dashed #777;
        box-shadow: none;
        justify-content: center;
        align-items: stretch;
    }

    .channel-strip-padding {
        flex: 1;
    }

    .now-playing {
        font-size: 0.7em;
        line-height: 1.2;
        text-align: center;
        overflow: hidden;
        word-break: break-word;
        max-height: 8em;
    }

    .spotify-strip {
        position: relative;
    }

    .popup {
        position: absolute;
        top: 46px;
        left: 6px;
        z-index: 10;
        width: 130px;
        padding: 6px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        background-color: rgb(50, 50, 54);
        border: 3px solid var(--theme-slider-trim);
        border-radius: 8px;
        box-shadow: 0 6px 14px #000b;
    }

    .transport {
        display: flex;
        gap: 3px;
    }

    .volume {
        height: 216px; /* matches the gain slider area in ChannelStripGain */
        padding: 8px 6px;
        box-sizing: border-box;
        display: flex;
        justify-content: center;
        align-items: stretch;
    }

    .remote-note {
        text-align: center;
        font-size: 0.7em;
        color: #999;
    }

    .empty-action {
        text-align: center;
        color: #999;
        font-family: inherit;
        font-weight: bold;
    }

    .empty-action {
        background: none;
        border: none;
        cursor: pointer;
        text-decoration: none;
        font-size: 1em;
        padding: 8px 0;
    }

    .empty-action:hover:not(:disabled) {
        color: #fff;
    }

    .error {
        margin-top: 6px;
        font-size: 0.65em;
        color: #f88;
        text-align: center;
        word-break: break-word;
    }
</style>
