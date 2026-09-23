<script lang="ts">
    import ChannelStrip from "./ChannelStrip/ChannelStrip.svelte";
    import ChannelStripGroup from "./ChannelStrip/ChannelStripGroup.svelte";
    import type { Resource } from "$lib/resources/common/types";
    import PlayIcon from "$lib/audio/client/components/PlayIcon.svelte";
    import PauseIcon from "$lib/audio/client/components/PauseIcon.svelte";
    import ChannelStripGroupAmbience from "./ChannelStrip/ChannelStripGroupAmbience.svelte";
    import DayIcon from "$lib/assets/dayIcon.svelte";
    import NightIcon from "$lib/assets/nightIcon.svelte";
    import { AudioClockTrack } from "../AudioClockTrack.svelte";
    import type { AudioEngine } from "../AudioEngine.svelte";
    import type { SpotifyPlayer } from "../SpotifyPlayer.svelte";
    import type { SpotifyPreset } from "$lib/audio/common/spotifyPreset";
    import ChannelStripSpotify from "./ChannelStrip/ChannelStripSpotify.svelte";
    
    let {
        audioEngine,
        ambienceResources,
        spotify = undefined,
        spotifyPresets = []
    }: {
        audioEngine: AudioEngine
        ambienceResources: Resource[];
        spotify?: SpotifyPlayer;
        spotifyPresets?: SpotifyPreset[];
    } = $props();

</script>

<style>
    .mixer-groups {
        display: flex;
        /* Stretch (rather than flex-start) so both mixers match heights - they hold different channel
           strips, which would otherwise size each group to its own tallest strip independently. */
        align-items: stretch;
        /* Gap between the two mixers - the main one (ambience/Spotify) and the clocks/sting one. */
        gap: 40px;
        /* Centred when it fits; left-aligned (so scrollable) when wider than the screen. justify-content: center
           would instead push the overflow off the left edge, where it can't be scrolled to. */
        width: max-content;
        margin: 0 auto;
    }

    .mixer-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .mixer-group-title {
        display: flex;
        align-items: center;
        gap: 10px;
        color: #999;
        font-size: 0.75em;
        font-weight: bold;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    .mixer-group-title::before,
    .mixer-group-title::after {
        content: "";
        flex: 1;
        height: 1px;
        background: var(--theme-slider-trim);
    }

    .mixer-channel-strips {
        display: flex;
        gap: 5px;
        align-items: stretch;
        /* Fills the rest of the group's height below the title, so both groups' strip rows still line up
           even though one group's title takes the same space as the other's. */
        flex: 1;
    }
</style>

<div class="mixer-main">
    <div class="mixer-groups">
        {#if audioEngine}
        <div class="mixer-group">
            <div class="mixer-group-title">Music &amp; Ambience</div>
            <div class="mixer-channel-strips">
            {#if audioEngine.ambienceEngine !== null}
            {#snippet ambienceEngineTitle()}
                <div style="display: flex; gap: 0.5em; justify-content: center; align-items: center;">
                    {#if audioEngine.timeOfDay === 'day'}
                    <DayIcon size={14}/>
                    {:else}
                    <NightIcon size={14}/>
                    {/if}
                    <span>Ambience Engine</span>
                    {#if audioEngine?.ambienceEngine?.effectivelyPlaying}
                    <PlayIcon/>
                    {:else}
                    <PauseIcon/>
                    {/if}
                </div>
            {/snippet}
            <ChannelStripGroupAmbience engine={audioEngine.ambienceEngine} timeOfDay={audioEngine.timeOfDay} resources={ambienceResources} onTitleClick={()=>{audioEngine?.ambienceEngine?.togglePlayPause()}} style="--theme-slider-accent: #FAA;" title={ambienceEngineTitle}/>
            {/if}
            {#if spotify}
            <!-- Spotify plays in the SDK's own iframe, so it can't be routed through the master bus: it gets the
                 master gain applied to its own volume commands instead (see ChannelStripSpotify) so the master
                 fader still controls it, just via Spotify's own volume API rather than a Web Audio gain node -
                 it's still one of this mixer's own channels, not a separate thing, so it sits in the same row.
                 MASTER stays the rightmost strip, so this goes just before it rather than after. -->
            <ChannelStripSpotify {spotify} presets={spotifyPresets} masterGain={audioEngine.gain} style="--theme-slider-accent: #AFA;"/>
            {/if}
            <ChannelStrip audioTrack={audioEngine} title="MASTER" style="--theme-slider-accent: #DCC"/>
            </div>
        </div>
        <!-- Clocks (player bells) and the sting engine get their own mixer, with its own independent master
             fader (audioEngine.clocksMaster) rather than sharing the one above - see AudioEngine.svelte.ts. -->
        <div class="mixer-group">
            <div class="mixer-group-title">SFX</div>
            <div class="mixer-channel-strips">
            {#if audioEngine.stingEngine !== null}
            <ChannelStrip audioTrack={audioEngine.stingEngine} title="STING" onTitleClick={()=>{audioEngine?.stingEngine?.trigger()}} style="--theme-slider-accent: #FA5;"/>
            {/if}
            <ChannelStripGroup model={audioEngine.clockAudioTracks} onChildTitleClick={(clock, index)=>{
                clock.ringFinalBell();
            }}/>
            <ChannelStrip audioTrack={audioEngine.clocksMaster} title="MASTER" style="--theme-slider-accent: #DCC"/>
            </div>
        </div>
        {/if}
    </div>
</div>