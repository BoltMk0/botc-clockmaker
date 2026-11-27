<script lang="ts">
    import { untrack } from "svelte";
    import AudioMixerText from "./AudioMixerText.svelte";
    import VSlider from "../VSlider.svelte";
    import VLoudnessMeter from "../VLoudnessMeter.svelte";
    import { FADER_MAX_DB, FADER_MIN_DB, formatGain } from "../util";
    import { DEFAULT_MUSIC_GAIN } from "$lib/audio/common/model/musicModel";
    import PlayIcon from "../PlayIcon.svelte";
    import PauseIcon from "../PauseIcon.svelte";
    import type { MusicPlayer } from "../../MusicPlayer.svelte";
    import { TIMES_OF_DAY } from "$lib/model/client/types";
    import { isMusicAdaptivePreset, type MusicPreset } from "$lib/audio/common/musicPreset";
    import NowPlayingPanel, { type PlaybackState } from "./NowPlayingPanel.svelte";

    /**
     * The mixer's strip for the uploaded-music player while it's running - laid out like the Spotify one, which can run
     * beside it (starting either fades the other out). The music plays through the Music & Ambience master bus on the host, so the
     * master fader, dim and time-of-day trim apply to it there.
     */
    let {
        music,
        presets = [],
        /** Whether this is the selected player (see selectedMusicSource): only then does its now playing panel show its loaded preset, as the selected one. */
        selected = true,
        /** Opens the music controls (the remote's music view), from the now playing panel. */
        onopen,
        style = undefined
    }: {
        music: MusicPlayer;
        presets?: MusicPreset[];
        selected?: boolean;
        onopen: () => void;
        style?: string;
    } = $props();

    const model = $derived(music.model);
    /** The fader, as a linear gain (shown in dB, like the ambience tracks'). */
    let gain = $state(untrack(() => model?.gain ?? DEFAULT_MUSIC_GAIN));
    // When this strip last sent a gain. Echoes of earlier values from a drag's coalesced sends can arrive
    // while it's still moving, so remote gain changes are ignored for a moment afterwards.
    let lastLocalGainChange = 0;
    const REMOTE_GAIN_GRACE_MS = 1000;
    function setGain(value: number) {
        gain = value;
        lastLocalGainChange = Date.now();
        music.setGain(value);
    }
    $effect(() => {
        // Follows gain changes made elsewhere (another mixer)
        const remote = model?.gain;
        if (remote === undefined) return;
        untrack(() => {
            if (Date.now() - lastLocalGainChange < REMOTE_GAIN_GRACE_MS) return;
            gain = remote;
        });
    });

    let menuOpen = $state(false);
    /** Centres a transport button's glyph both ways (an inline SVG otherwise sits on the text baseline). */
    const CENTER = "display: flex; justify-content: center; align-items: center; height: 30px;";

    // What the now playing panel shows: the player's state, and its presets loaded, being switched to and waiting
    /** The preset loaded, while this is the selected player (otherwise the other one has taken over). */
    const currentPreset = $derived(selected ? presets.find(p => p.id === model?.presetId) : undefined);
    const silent = $derived(!!currentPreset && isMusicAdaptivePreset(currentPreset) && model?.presetSilent === true);
    const playbackState: PlaybackState = $derived(silent ? 'silent' : music.playing ? 'playing' : music.track ? 'paused' : 'idle');
    /** For an adaptive preset, the phases whose playlist is loaded. */
    const loadedPhases = $derived.by(() => {
        const preset = currentPreset;
        if (!preset || !isMusicAdaptivePreset(preset) || silent) return [];
        return TIMES_OF_DAY.filter(phase => preset.phasePlaylistIds[phase] !== null && preset.phasePlaylistIds[phase] === music.track?.playlistId);
    });
    const pendingName = $derived(presets.find(p => p.id === model?.pendingPresetId)?.name ?? null);
    const nextName = $derived(presets.find(p => p.id === model?.scheduledPresetId)?.name ?? null);
</script>

<svelte:window
    onpointerdown={(ev)=>{ if(menuOpen && !(ev.target as Element).closest?.('.music-strip')) menuOpen = false; }}
    onkeydown={(ev)=>{ if(ev.key === 'Escape') menuOpen = false; }}
/>

{#if model}
<div class="channel-strip-main music-strip" style={style}>
    <AudioMixerText onclick={()=>menuOpen = !menuOpen} style="margin-bottom: 5px;" title={music.isHost ? 'Playing from this device. Click for controls' : 'Playing from another device. Click for controls'}>Music</AudioMixerText>
    {#if menuOpen}
    <div class="popup">
        <div class="transport">
            <AudioMixerText onclick={()=>music.previous()} style={CENTER} title="Previous track">&#9198;</AudioMixerText>
            <AudioMixerText onclick={()=>music.togglePlayPause()} style={CENTER} title={music.playing ? 'Pause' : 'Play'}>
                <!-- (Component names are the other way round: PlayIcon draws the pause bars, PauseIcon the triangle.) -->
                {#if music.playing}<PlayIcon/>{:else}<PauseIcon/>{/if}
            </AudioMixerText>
            <AudioMixerText onclick={()=>music.next()} style={CENTER} title="Next track">&#9197;</AudioMixerText>
        </div>
        {#if music.isHost}
        <AudioMixerText onclick={()=>{ menuOpen = false; music.stopHosting(); }} title="Stop the player on this device so another can take over">Stop player</AudioMixerText>
        {:else}
        <div class="remote-note">Playing from another device</div>
        {/if}
    </div>
    {/if}
    <!-- Fills the space left by the rest of the strip; opens the music controls -->
    <NowPlayingPanel playback={playbackState} presetName={currentPreset?.name ?? null} phases={loadedPhases}
        track={music.track} progress={model.progress} imageUrl={music.track?.imageUrl ?? null} {pendingName} {nextName} onclick={onopen}
        emptyText={presets.length > 0 ? 'Nothing playing. Click to pick a preset.' : 'Nothing playing. Add music presets in Settings → Music Library.'}/>
    <AudioMixerText>Gain<br/>{formatGain(gain)}</AudioMixerText>
    <!-- Laid out as in ChannelStripGain. The meter only shows on the device playing the music. -->
    <div class="volume">
        <div class="fader">
            <VSlider value={gain} min={FADER_MIN_DB} max={FADER_MAX_DB} step={1} logarithmic onchange={setGain}/>
        </div>
        {#if music.analyser}
        <VLoudnessMeter analyserNode={music.analyser}/>
        {/if}
    </div>
    {#if music.error}<div class="error">{music.error}</div>{/if}
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

    .music-strip {
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
        align-items: stretch;
    }

    .fader {
        flex: 1;
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
