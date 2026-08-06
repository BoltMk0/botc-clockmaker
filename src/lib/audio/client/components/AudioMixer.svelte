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
    
    let {
        audioEngine,
        ambienceResources
    }: {
        audioEngine: AudioEngine
        ambienceResources: Resource[];
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
        <ChannelStripGroupAmbience engine={audioEngine.ambienceEngine} model={audioEngine.ambienceEngine} resources={ambienceResources} onTitleClick={()=>{audioEngine?.ambienceEngine?.togglePlayPause()}} style="--theme-slider-accent: #FAA;" title={ambienceEngineTitle}/>
        {/if}
        <ChannelStripGroup model={audioEngine.clockAudioTracks} onChildTitleClick={(clock, index)=>{
            clock.ringFinalBell();
        }}/>
        <ChannelStrip audioTrack={audioEngine} title="MASTER" style="--theme-slider-accent: #DCC"/>
        {/if}

        
    </div>
</div>