<script lang="ts">
    import { untrack } from "svelte";
    import AudioMixerText from "./AudioMixerText.svelte";
    import VSlider from "../VSlider.svelte";
    import PlayIcon from "../PlayIcon.svelte";
    import PauseIcon from "../PauseIcon.svelte";
    import type { SpotifyPlayer } from "../../SpotifyPlayer.svelte";
    import { isSameSpotifyContext, type SpotifyPreset } from "$lib/audio/common/spotifyPreset";

    const NOW_PLAYING_LINE_PX = 14; // Keep in step with .now-playing-text line-height

    let {
        spotify,
        presets = [],
        // Linear multiplier from the mixer's master gain fader. Spotify plays through its own device/SDK
        // rather than the Web Audio master bus, so it can't pick this up like every other channel does -
        // instead it's folded into the volume this strip sends Spotify (see setVolume/the masterGain effect
        // below), so the master fader still ducks/mutes it in step with everything else. This fader's own
        // slider position (rawVolume) is deliberately kept independent of it, though - only the combined
        // value sent to Spotify moves, never the slider itself.
        masterGain = 1,
        style = undefined
    }: {
        spotify: SpotifyPlayer;
        presets?: SpotifyPreset[];
        masterGain?: number;
        style?: string;
    } = $props();

    const model = $derived(spotify.model);
    // The fader's own (pre-master-gain) position, independent of the combined value actually sent to
    // Spotify (and reflected back in model.volume) - so a later master gain change can be reapplied to it
    // without needing to divide the combined value back out.
    let rawVolume = $state(untrack(() => model?.volume ?? 50));
    let appliedMasterGain = untrack(() => masterGain);
    $effect(() => {
        // Re-sends the current fader position at the new master gain whenever the fader moves this - not on
        // mount, so simply opening the mixer doesn't stomp on whatever volume is already playing.
        const gain = masterGain;
        if (gain === appliedMasterGain) return;
        appliedMasterGain = gain;
        spotify.setVolume(Math.round(rawVolume * gain));
    });
    const active = $derived(model !== null && model.hostClientId !== null);
    let menuOpen = $state(false);
    let nowPlayingHeight = $state(0);
    const nowPlayingLines = $derived(Math.max(1, Math.floor(nowPlayingHeight / NOW_PLAYING_LINE_PX)));
    /** Centres a transport button's glyph both ways (an inline SVG otherwise sits on the text baseline). */
    /** Highlights the preset that's currently loaded. */
    const CURRENT_PRESET = "background-color: #fff; color: #222;";
    /** The preset being switched to (during the fade-out), distinct from the one currently loaded. */
    const PENDING_PRESET = "background-color: #fc6; color: #222;";
    const PRESET_ROW = "display: flex; align-items: center; gap: 4px; text-align: left;";
    const CENTER = "display: flex; justify-content: center; align-items: center; height: 30px;";
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
            <AudioMixerText onclick={()=>spotify.previous()} style={CENTER} title="Previous track">&#9198;</AudioMixerText>
            <AudioMixerText onclick={()=>spotify.togglePlayPause()} style={CENTER} title={spotify.playback?.playing ? 'Pause' : 'Play'}>
                {#if spotify.playback?.playing}<PlayIcon/>{:else}<PauseIcon/>{/if}
            </AudioMixerText>
            <AudioMixerText onclick={()=>spotify.next()} style={CENTER} title="Next track">&#9197;</AudioMixerText>
        </div>
        {#if spotify.isHost}
        <AudioMixerText onclick={()=>{ menuOpen = false; spotify.stopHosting(); }} title="Stop the player on this device so another can take over">Stop player</AudioMixerText>
        {:else}
        <div class="remote-note">Playing from another device</div>
        {/if}
    </div>
    {/if}
    {#if !model.hostReady}
        <div class="starting">Starting…</div>
    {:else}
        <!-- Fills the space left by the rest of the strip; the text is clamped to however many lines fit. -->
        <div class="now-playing" bind:clientHeight={nowPlayingHeight} title={spotify.playback ? `${spotify.playback.title} - ${spotify.playback.artist}` : ''}>
            <div class="now-playing-text" style="-webkit-line-clamp: {nowPlayingLines};">
            {#if spotify.playback}
                <strong>{spotify.playback.title}</strong><br/>{spotify.playback.artist}
            {:else}
                Nothing playing. Pick "Clocktower Mixer" in Spotify.
            {/if}
            </div>
        </div>
        {#if presets.length > 0}
        <div class="presets">
            {#each presets as preset (preset.id)}
                {@const current = isSameSpotifyContext(spotify.playback?.contextUri, preset.uri)}
                {@const playing = current && spotify.playback?.playing === true}
                {@const pending = isSameSpotifyContext(model.pendingContextUri, preset.uri)}
                <!-- The loaded preset just toggles play/pause; any other starts playing from the beginning. -->
                <AudioMixerText
                    onclick={()=>current ? spotify.togglePlayPause() : spotify.playContext(preset.uri)}
                    style="{PRESET_ROW} {pending ? PENDING_PRESET : current ? CURRENT_PRESET : ''}"
                    title={pending ? `Loading ${preset.name}` : playing ? `Pause ${preset.name}` : current ? `Resume ${preset.name}` : `Play ${preset.name}`}>
                    <span class="preset-icon">
                        <!-- (Component names are the other way round: PlayIcon draws the pause bars, PauseIcon the triangle.) -->
                        {#if playing}<PlayIcon size={10}/>{:else}<PauseIcon size={10}/>{/if}
                    </span>
                    <span class="preset-name">{preset.name}</span>
                </AudioMixerText>
            {/each}
        </div>
        {/if}
        <div class="skip">
            <AudioMixerText onclick={()=>spotify.previous()} style={CENTER} title="Previous track">&#9198;</AudioMixerText>
            <AudioMixerText onclick={()=>spotify.next()} style={CENTER} title="Next track">&#9197;</AudioMixerText>
        </div>
        <AudioMixerText>Vol<br/>{Math.round(rawVolume)}%</AudioMixerText>
        <div class="volume">
            <!-- Bound to our own rawVolume, not model.volume: model.volume is the combined (post-master-gain)
                 value actually sent to Spotify, so binding directly to it would make the fader visibly jump
                 around whenever the master fader moves - this slider is meant to stay put, independent of it. -->
            <VSlider value={rawVolume} min={0} max={100} step={1} onchange={(v)=>{ rawVolume = v; spotify.setVolume(Math.round(v * masterGain)); }}/>
        </div>
    {/if}
    {#if spotify.error}<div class="error">{spotify.error}</div>{/if}
</div>
{:else if !model.authorized}
<!-- The whole dashed area is the click target (not just the text), so it's easy to hit. -->
<a class="channel-strip-main empty clickable" style={style} href="/api/spotify/auth" data-sveltekit-reload>
    <div class="empty-text">+<br/>Link<br/>Spotify</div>
    {#if spotify.error}<div class="error">{spotify.error}</div>{/if}
</a>
{:else if !spotify.canHost}
<div class="channel-strip-main empty" style={style}>
    <div class="empty-text">Spotify<br/>player not<br/>running</div>
    {#if spotify.error}<div class="error">{spotify.error}</div>{/if}
</div>
{:else}
<button class="channel-strip-main empty clickable" style={style} onclick={()=>spotify.startHosting()} disabled={spotify.starting}>
    <div class="empty-text">{#if spotify.starting}Starting…{:else}+<br/>Spotify<br/>player{/if}</div>
    {#if spotify.error}<div class="error">{spotify.error}</div>{/if}
</button>
{/if}
{/if}

<style>
    .channel-strip-main {
        width: 110px;
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
        /* Resets when this is rendered as a <button>/<a> (the clickable cases) rather than a plain <div>. */
        font: inherit;
        text-align: inherit;
        text-decoration: none;
        color: inherit;
        cursor: default;
    }

    .channel-strip-main.empty.clickable {
        cursor: pointer;
    }

    .channel-strip-main.empty.clickable:hover:not(:disabled) {
        border-color: #aaa;
    }

    .channel-strip-main.empty.clickable .empty-text {
        color: #ccc;
    }

    .channel-strip-main.empty:disabled {
        cursor: default;
        opacity: 0.7;
    }

    .starting {
        flex: 1;
        display: flex;
        justify-content: center;
        align-items: center;
        text-align: center;
        font-size: 11px;
    }

    .now-playing {
        flex: 1;
        min-height: 42px; /* at least three lines */
        overflow: hidden;
        margin-top: 2px;
    }

    .now-playing-text {
        font-size: 11px;
        line-height: 14px; /* keep in step with NOW_PLAYING_LINE_PX */
        text-align: center;
        word-break: break-word;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        overflow: hidden;
        text-overflow: ellipsis;
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

    .presets {
        display: flex;
        flex-direction: column;
        gap: 3px;
        margin: 6px 0;
        max-height: 130px;
        overflow-y: auto;
    }

    .preset-icon {
        display: flex;
        flex-shrink: 0;
    }

    .preset-name {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .skip {
        display: flex;
        gap: 3px;
        margin-bottom: 6px;
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

    .empty-text {
        text-align: center;
        color: #999;
        font-weight: bold;
        font-size: 0.8em;
        padding: 8px 0;
    }


    .error {
        margin-top: 6px;
        font-size: 0.65em;
        color: #f88;
        text-align: center;
        word-break: break-word;
    }
</style>
