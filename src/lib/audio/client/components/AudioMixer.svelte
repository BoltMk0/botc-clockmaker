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
        align-items: flex-start;
        /* Gap between the two mixers - the main one (ambience/Spotify) and the clocks/sting one. */
        gap: 40px;
        height: fit-content;
        /* Centred when it fits; left-aligned (so scrollable) when wider than the screen. justify-content: center
           would instead push the overflow off the left edge, where it can't be scrolled to. */
        width: max-content;
        margin: 0 auto;
    }

    .mixer-channel-strips {
        display: flex;
        gap: 5px;
        height: fit-content;
        align-items: stretch;
    }
</style>

<div class="mixer-main">
    <div class="mixer-groups">
        {#if audioEngine}
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
        <!-- Clocks (player bells) and the sting engine get their own mixer, with its own independent master
             fader (audioEngine.clocksMaster) rather than sharing the one above - see AudioEngine.svelte.ts. -->
        <div class="mixer-channel-strips">
            {#if audioEngine.stingEngine !== null}
            <ChannelStrip audioTrack={audioEngine.stingEngine} title="STING" onTitleClick={()=>{audioEngine?.stingEngine?.trigger()}} style="--theme-slider-accent: #FA5;"/>
            {/if}
            <ChannelStripGroup model={audioEngine.clockAudioTracks} onChildTitleClick={(clock, index)=>{
                clock.ringFinalBell();
            }}/>
            <ChannelStrip audioTrack={audioEngine.clocksMaster} title="MASTER" style="--theme-slider-accent: #DCC"/>
        </div>
        {/if}
    </div>
</div>