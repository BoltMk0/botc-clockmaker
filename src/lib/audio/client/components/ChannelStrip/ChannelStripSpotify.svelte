<script lang="ts">
    import { untrack } from "svelte";
    import AudioMixerText from "./AudioMixerText.svelte";
    import VSlider from "../VSlider.svelte";
    import PlayIcon from "../PlayIcon.svelte";
    import PauseIcon from "../PauseIcon.svelte";
    import type { SpotifyPlayer } from "../../SpotifyPlayer.svelte";
    import TimeOfDayIcon from "$lib/assets/timeOfDayIcon.svelte";
    import { TIMES_OF_DAY } from "$lib/model/client/types";
        import { isAdaptivePresetContext, isSameSpotifyContext, isSpotifyAdaptivePreset, type SpotifyPreset } from "$lib/audio/common/spotifyPreset";

    const NOW_PLAYING_LINE_PX = 14; // Keep in step with .now-playing-text line-height

    let {
        spotify,
        presets = [],
        // (Spotify plays through its own device/SDK rather than the Web Audio master bus, so the server applies the
        // shared master fader, dim and time-of-day trim to the volume it sends the player instead - see SpotifyHelper.)
        style = undefined
    }: {
        spotify: SpotifyPlayer;
        presets?: SpotifyPreset[];
        style?: string;
    } = $props();

    const model = $derived(spotify.model);
    let volume = $state(untrack(() => model?.volume ?? 50));
    // When this strip last sent a volume. Echoes of earlier values from a drag's coalesced sends can arrive
    // while it's still moving, so remote volume changes are ignored for a moment afterwards.
    let lastLocalVolumeChange = 0;
    const REMOTE_VOLUME_GRACE_MS = 1000;
    function setVolume(value: number) {
        volume = value;
        lastLocalVolumeChange = Date.now();
        spotify.setVolume(Math.round(value));
    }
    $effect(() => {
        // Follows volume changes made elsewhere (another mixer, the grim)
        const remote = model?.volume;
        if (remote === undefined) return;
        untrack(() => {
            if (Date.now() - lastLocalVolumeChange < REMOTE_VOLUME_GRACE_MS) return;
            volume = remote;
        });
    });
    /**
     * Whether `uri` is one of the preset's albums/playlists. An adaptive playlist only counts while it's the one selected;
     * a plain one only while no adaptive playlist is, so the two kinds can share a playlist without both lighting up. An
     * adaptive playlist waiting out a silent spell counts whatever's loaded.
     */
    function presetMatches(preset: SpotifyPreset, uri: string | null | undefined) {
        if (isSpotifyAdaptivePreset(preset)) {
            if (model?.adaptivePresetId !== preset.id) return false;
            return isAdaptivePresetContext(preset, uri) || model.adaptivePresetSilent;
        }
        return !model?.adaptivePresetId && isSameSpotifyContext(uri, preset.uri);
    }

    function presetKind(preset: SpotifyPreset) {
        return isSpotifyAdaptivePreset(preset) ? ' (ambient adaptive)' : '';
    }

    /**
     * The loaded preset just toggles play/pause. Another one, while something's playing, is scheduled to take over at the
     * next change of phase; tapped again, it switches straight away. With nothing playing, it starts at once. A paused
     * adaptive playlist is resumed through the server, which switches it to the right list for the phase (or keeps it
     * quiet, if the phase has none).
     */
    function clickPreset(preset: SpotifyPreset, current: boolean, playing: boolean) {
        if (playing) spotify.togglePlayPause();
        else if (!current && model?.scheduledPresetId !== preset.id && spotify.playback?.playing) spotify.schedulePreset(preset.id);
        else if (isSpotifyAdaptivePreset(preset)) spotify.playAdaptivePreset(preset.id);
        else if (current) spotify.togglePlayPause();
        else spotify.playContext(preset.uri);
    }

    let menuOpen = $state(false);
    let nowPlayingHeight = $state(0);
    const nowPlayingLines = $derived(Math.max(1, Math.floor(nowPlayingHeight / NOW_PLAYING_LINE_PX)));
    /** Centres a transport button's glyph both ways (an inline SVG otherwise sits on the text baseline). */
    /** Highlights the preset that's currently loaded. */
    const CURRENT_PRESET = "background-color: #fff; color: #222;";
    /** The preset being switched to (during the fade-out), distinct from the one currently loaded. */
    const PENDING_PRESET = "background-color: #fc6; color: #222;";
    /** The preset waiting for the next phase change: outlined in the pending colour, as it's next in line. */
    const SCHEDULED_PRESET = "box-shadow: inset 0 0 0 2px #fc6;";
    const PRESET_ROW = "display: flex; align-items: center; gap: 4px; text-align: left;";
    const CENTER = "display: flex; justify-content: center; align-items: center; height: 30px;";
</script>

<svelte:window
    onpointerdown={(ev)=>{ if(menuOpen && !(ev.target as Element).closest?.('.spotify-strip')) menuOpen = false; }}
    onkeydown={(ev)=>{ if(ev.key === 'Escape') menuOpen = false; }}
/>

{#if model}
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
                {@const current = presetMatches(preset, spotify.playback?.contextUri)}
                {@const playing = current && spotify.playback?.playing === true}
                {@const pending = presetMatches(preset, model.pendingContextUri)}
                {@const kind = presetKind(preset)}
                {@const waiting = current && isSpotifyAdaptivePreset(preset) && model.adaptivePresetSilent}
                {@const scheduled = model.scheduledPresetId === preset.id}
                <AudioMixerText
                    onclick={()=>clickPreset(preset, current, playing)}
                    style="{PRESET_ROW} {pending ? PENDING_PRESET : current ? CURRENT_PRESET : scheduled ? SCHEDULED_PRESET : ''}"
                    title={pending ? `Loading ${preset.name}${kind}` : scheduled ? `${preset.name}${kind} plays at the next phase change. Tap again to switch now` : !current && spotify.playback?.playing ? `Play ${preset.name}${kind} at the next phase change (tap twice to switch now)` : waiting ? `${preset.name}${kind}: silent until a phase with a list` : playing ? `Pause ${preset.name}${kind}` : current ? `Resume ${preset.name}${kind}` : `Play ${preset.name}${kind}`}>
                    <span class="preset-icon">
                        <!-- (Component names are the other way round: PlayIcon draws the pause bars, PauseIcon the triangle.) -->
                        {#if playing}<PlayIcon size={10}/>{:else}<PauseIcon size={10}/>{/if}
                    </span>
                    <span class="preset-name">{preset.name}</span>
                    {#if isSpotifyAdaptivePreset(preset)}
                        <!-- The phase whose list is loaded (none while silent), or every phase with a list when it isn't playing -->
                        <span class="preset-icon">
                            {#each TIMES_OF_DAY as phase}
                                {@const uri = preset.phaseUris[phase]}
                                {#if uri !== null && (!current || (!waiting && isSameSpotifyContext(spotify.playback?.contextUri, uri)))}<TimeOfDayIcon timeOfDay={phase} size={10}/>{/if}
                            {/each}
                        </span>
                    {/if}
                </AudioMixerText>
            {/each}
        </div>
        {/if}
        <div class="skip">
            <AudioMixerText onclick={()=>spotify.previous()} style={CENTER} title="Previous track">&#9198;</AudioMixerText>
            <AudioMixerText onclick={()=>spotify.next()} style={CENTER} title="Next track">&#9197;</AudioMixerText>
        </div>
        <AudioMixerText>Vol<br/>{Math.round(volume)}%</AudioMixerText>
        <div class="volume">
            <VSlider value={volume} min={0} max={100} step={1} onchange={setVolume}/>
        </div>
    {/if}
    {#if spotify.error}<div class="error">{spotify.error}</div>{/if}
</div>
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

    .error {
        margin-top: 6px;
        font-size: 0.65em;
        color: #f88;
        text-align: center;
        word-break: break-word;
    }
</style>
