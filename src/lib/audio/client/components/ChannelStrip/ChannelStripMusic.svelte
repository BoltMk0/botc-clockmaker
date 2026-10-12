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
    import TimeOfDayIcon from "$lib/assets/timeOfDayIcon.svelte";
    import { TIMES_OF_DAY } from "$lib/model/client/types";
    import { COUNTDOWN_PHASES } from "$lib/audio/common/spotifyPreset";
    import { isMusicAdaptivePreset, isMusicCountdownPreset, type MusicPreset } from "$lib/audio/common/musicPreset";

    const NOW_PLAYING_LINE_PX = 14; // Keep in step with .now-playing-text line-height

    /**
     * The mixer's music strip while the uploaded-music player is running - laid out like the Spotify one, which it
     * shares the strip's place with. The music plays through the Music & Ambience master bus on the host, so the
     * master fader, dim and time-of-day trim apply to it there.
     */
    let {
        music,
        presets = [],
        style = undefined
    }: {
        music: MusicPlayer;
        presets?: MusicPreset[];
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

    function presetKind(preset: MusicPreset) {
        return isMusicAdaptivePreset(preset) ? ' (ambient adaptive)' : isMusicCountdownPreset(preset) ? ' (day & night)' : '';
    }

    /**
     * The loaded preset just toggles play/pause. Another one, while something's playing, is scheduled to take over at the
     * next change of phase; tapped again, it switches straight away. With nothing playing, it starts at once (a paused
     * one carries on where it left off).
     */
    function clickPreset(preset: MusicPreset, current: boolean, playing: boolean) {
        if (playing) music.togglePlayPause();
        else if (!current && model?.scheduledPresetId !== preset.id && music.playing) music.schedulePreset(preset.id);
        else music.playPreset(preset.id);
    }

    let menuOpen = $state(false);
    let nowPlayingHeight = $state(0);
    const nowPlayingLines = $derived(Math.max(1, Math.floor(nowPlayingHeight / NOW_PLAYING_LINE_PX)));
    /** Highlights the preset that's currently loaded. */
    const CURRENT_PRESET = "background-color: #fff; color: #222;";
    /** The preset being switched to (during the fade-out), distinct from the one currently loaded. */
    const PENDING_PRESET = "background-color: #fc6; color: #222;";
    /** The preset waiting for the next phase change: outlined in the pending colour, as it's next in line. */
    const SCHEDULED_PRESET = "box-shadow: inset 0 0 0 2px #fc6;";
    const PRESET_ROW = "display: flex; align-items: center; gap: 4px; text-align: left;";
    /** Centres a transport button's glyph both ways (an inline SVG otherwise sits on the text baseline). */
    const CENTER = "display: flex; justify-content: center; align-items: center; height: 30px;";
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
        <AudioMixerText onclick={()=>{ menuOpen = false; music.stopHosting(); }} title="Stop the player on this device so another (or Spotify) can take over">Stop player</AudioMixerText>
        {:else}
        <div class="remote-note">Playing from another device</div>
        {/if}
    </div>
    {/if}
    <!-- Fills the space left by the rest of the strip, over the album artwork; the text is clamped to however many lines fit. -->
    <div class="now-playing" class:has-art={!!music.track?.imageUrl} style:background-image={music.track?.imageUrl ? `url("${music.track.imageUrl}")` : undefined}
        bind:clientHeight={nowPlayingHeight} title={music.track ? `${music.track.title} - ${music.track.artist}` : ''}>
        <div class="now-playing-text" style="-webkit-line-clamp: {nowPlayingLines};">
        {#if music.track}
            <strong>{music.track.title}</strong><br/>{music.track.artist}
        {:else if presets.length > 0}
            Nothing playing. Pick a preset.
        {:else}
            Nothing playing. Add music presets in Settings &rarr; Music.
        {/if}
        </div>
    </div>
    {#if presets.length > 0}
    <div class="presets">
        {#each presets as preset (preset.id)}
            {@const current = model.presetId === preset.id}
            {@const playing = current && music.playing}
            {@const pending = model.pendingPresetId === preset.id}
            {@const kind = presetKind(preset)}
            {@const waiting = current && isMusicCountdownPreset(preset) && model.presetSilent}
            {@const scheduled = model.scheduledPresetId === preset.id}
            {@const loadedPlaylist = current && !waiting ? music.track?.playlistId : undefined}
            <AudioMixerText
                onclick={()=>clickPreset(preset, current, playing)}
                style="{PRESET_ROW} {pending ? PENDING_PRESET : current ? CURRENT_PRESET : scheduled ? SCHEDULED_PRESET : ''}"
                title={pending ? `Loading ${preset.name}${kind}` : scheduled ? `${preset.name}${kind} plays at the next phase change. Tap again to switch now` : !current && music.playing ? `Play ${preset.name}${kind} at the next phase change (tap twice to switch now)` : waiting ? `${preset.name}${kind}: silent until the countdown starts or night falls` : playing ? `Pause ${preset.name}${kind}` : current ? `Resume ${preset.name}${kind}` : `Play ${preset.name}${kind}`}>
                <span class="preset-icon">
                    {#if playing}<PlayIcon size={10}/>{:else}<PauseIcon size={10}/>{/if}
                </span>
                <span class="preset-name">{preset.name}</span>
                {#if isMusicAdaptivePreset(preset)}
                    <!-- The phases whose playlist is loaded, or every phase with one when none is -->
                    <span class="preset-icon">
                        {#each TIMES_OF_DAY as phase}
                            {@const id = preset.phasePlaylistIds[phase]}
                            {#if id !== null && (!current || loadedPlaylist === id)}<TimeOfDayIcon timeOfDay={phase} size={10}/>{/if}
                        {/each}
                    </span>
                {:else if isMusicCountdownPreset(preset)}
                    <!-- Likewise: the playlist that's loaded (none while silent), or both when it isn't playing -->
                    <span class="preset-icon">
                        {#each COUNTDOWN_PHASES as phase}
                            {@const id = preset.countdownPlaylistIds[phase]}
                            {#if id !== null && (!current || loadedPlaylist === id)}<TimeOfDayIcon timeOfDay={phase} size={10}/>{/if}
                        {/each}
                    </span>
                {/if}
            </AudioMixerText>
        {/each}
    </div>
    {/if}
    <div class="skip">
        <AudioMixerText onclick={()=>music.previous()} style={CENTER} title="Previous track">&#9198;</AudioMixerText>
        <AudioMixerText onclick={()=>music.next()} style={CENTER} title="Next track">&#9197;</AudioMixerText>
    </div>
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

    .now-playing {
        flex: 1;
        min-height: 42px; /* at least three lines */
        overflow: hidden;
        margin-top: 2px;
        border-radius: 4px;
        background-size: cover;
        background-position: center;
    }

    /* Over the artwork: darkened behind the text, so it stays readable */
    .now-playing.has-art .now-playing-text {
        height: 100%;
        box-sizing: border-box;
        padding: 3px;
        background-color: #000a;
        color: #eee;
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
