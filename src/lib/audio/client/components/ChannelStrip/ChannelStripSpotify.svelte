<script lang="ts">
    import { untrack } from "svelte";
    import AudioMixerText from "./AudioMixerText.svelte";
    import VSlider from "../VSlider.svelte";
    import PlayIcon from "../PlayIcon.svelte";
    import PauseIcon from "../PauseIcon.svelte";
    import type { SpotifyPlayer } from "../../SpotifyPlayer.svelte";
    import { TIMES_OF_DAY } from "$lib/model/client/types";
    import { isSameSpotifyContext, isSpotifyAdaptivePreset, spotifyPresetMatches, type SpotifyPreset } from "$lib/audio/common/spotifyPreset";
    import NowPlayingPanel, { type PlaybackState } from "./NowPlayingPanel.svelte";

    let {
        spotify,
        presets = [],
        /** Whether this is the selected player (see selectedMusicSource): only then does its now playing panel show its loaded preset, as the selected one. */
        selected = true,
        /** Opens the music controls (the remote's music view), from the now playing panel. */
        onopen,
        // (Spotify plays through its own device/SDK rather than the Web Audio master bus, so the server applies the
        // shared master fader, dim and time-of-day trim to the volume it sends the player instead - see SpotifyHelper.)
        style = undefined
    }: {
        spotify: SpotifyPlayer;
        presets?: SpotifyPreset[];
        selected?: boolean;
        onopen: () => void;
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
    let menuOpen = $state(false);
    /** Centres a transport button's glyph both ways (an inline SVG otherwise sits on the text baseline). */
    const CENTER = "display: flex; justify-content: center; align-items: center; height: 30px;";

    // What the now playing panel shows: the player's state, and its presets loaded, being switched to and waiting
    /** The preset loaded, while this is the selected player (otherwise the other one has taken over). */
    const currentPreset = $derived(selected ? presets.find(p => spotifyPresetMatches(p, model, spotify.playback?.contextUri)) : undefined);
    const silent = $derived(!!currentPreset && isSpotifyAdaptivePreset(currentPreset) && model?.adaptivePresetSilent === true);
    const playbackState: PlaybackState = $derived(silent ? 'silent' : spotify.playback?.playing ? 'playing' : spotify.playback ? 'paused' : 'idle');
    /** For an adaptive preset, the phase whose list is loaded. */
    const loadedPhases = $derived.by(() => {
        const preset = currentPreset;
        if (!preset || !isSpotifyAdaptivePreset(preset) || silent) return [];
        return TIMES_OF_DAY.filter(phase => preset.phaseUris[phase] !== null && isSameSpotifyContext(spotify.playback?.contextUri, preset.phaseUris[phase]));
    });
    const pendingName = $derived(presets.find(p => spotifyPresetMatches(p, model, model?.pendingContextUri))?.name ?? null);
    const nextName = $derived(presets.find(p => p.id === model?.scheduledPresetId)?.name ?? null);
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
        <!-- Fills the space left by the rest of the strip; opens the music controls -->
        <NowPlayingPanel playback={playbackState} presetName={currentPreset?.name ?? null} phases={loadedPhases}
            track={spotify.playback} progress={spotify.playback?.progress ?? null} imageUrl={spotify.playback?.imageUrl ?? null} {pendingName} {nextName} onclick={onopen}
            emptyText={'Nothing playing. Pick "Clocktower Mixer" in Spotify, or click to pick a preset.'}/>
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

    .error {
        margin-top: 6px;
        font-size: 0.65em;
        color: #f88;
        text-align: center;
        word-break: break-word;
    }
</style>
