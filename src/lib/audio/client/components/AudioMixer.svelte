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
    .mixer-channel-strips {
        display: flex;
        gap: 5px;
        height: fit-content;
        justify-content: center;
        align-items: stretch;
    }

    .spotify-separate {
        display: flex;
        margin-left: 40px;
    }
</style>

<div class="mixer-main">
    <div class="mixer-channel-strips">
            
        {#if audioEngine}
        {#if audioEngine.ambienceEngine !== null}
        {#snippet ambienceEngineTitle()}
            <div style="display: flex; gap: 0.5em; justify-content: center; align-items: center;">
                {#if audioEngine.timeOfDay === 'day'}
                <DayIcon size={14}/>
                {:else}
                <NightIcon size={14}/>
                {/if}
                <span>Ambience Engine</span>
                {#if audioEngine?.ambienceEngine?.playing}
                <PlayIcon/>
                {:else}
                <PauseIcon/>
                {/if}
            </div>
        {/snippet}
        <ChannelStripGroupAmbience engine={audioEngine.ambienceEngine} timeOfDay={audioEngine.timeOfDay} resources={ambienceResources} onTitleClick={()=>{audioEngine?.ambienceEngine?.togglePlayPause()}} style="--theme-slider-accent: #FAA;" title={ambienceEngineTitle}/>
        {/if}
        <ChannelStripGroup model={audioEngine.clockAudioTracks} onChildTitleClick={(clock, index)=>{
            clock.ringFinalBell();
        }}/>
        <ChannelStrip audioTrack={audioEngine} title="MASTER" style="--theme-slider-accent: #DCC"/>
        {/if}
        {#if spotify}
        <!-- Spotify plays in the SDK's own iframe, so it can't be routed through the master bus: keep it apart from the mixer proper. -->
        <div class="spotify-separate">
            <ChannelStripSpotify {spotify} presets={spotifyPresets} style="--theme-slider-accent: #AFA;"/>
        </div>
        {/if}

        
    </div>
</div>