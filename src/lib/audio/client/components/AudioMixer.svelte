<script lang="ts">
    import { ClocktowerAudioEngine } from "$lib/audio/client/model/AudioEngine.svelte";
    import type { ClockClientModel } from "$lib/model/client/ClockClientModel";
    import ChannelStrip from "./ChannelStrip/ChannelStrip.svelte";
    import ChannelStripGroup from "./ChannelStrip/ChannelStripGroup.svelte";
    import type { Resource } from "$lib/resources/common/types";
    import PlayIcon from "$lib/audio/client/components/PlayIcon.svelte";
    import PauseIcon from "$lib/audio/client/components/PauseIcon.svelte";
    
    let {
        clients,
        ambienceResources,
        audioEngine
    }: {
        clients: ClockClientModel[];
        ambienceResources: Resource[];
        audioEngine: ClocktowerAudioEngine;
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
        {#if audioEngine.ambienceTracks !== null}
        {#snippet ambienceEngineTitle()}
            <div style="display: flex; gap: 0.5em; justify-content: center; align-items: center;">
                <span>Ambience Engine</span>
                {#if audioEngine?.ambienceTracks?.playing}
                <PlayIcon/>
                {:else}
                <PauseIcon/>
                {/if}
            </div>
        {/snippet}
        <ChannelStripGroup model={audioEngine.ambienceTracks} onTitleClick={()=>{console.log("HEY"); audioEngine?.ambienceTracks?.togglePlayPause()}} style="--theme-slider-accent: #FAA;" title={ambienceEngineTitle}/>
        {/if}
        <ChannelStripGroup model={audioEngine.clockTracks} onChildTitleClick={(id)=>{
            clients.find(c=>c.clockId === id)?.ringFinalBell(true);
        }} onTitleClick={()=>{console.log("HEY")}}/>
        <ChannelStrip audioTrack={audioEngine} title="MASTER" style="--theme-slider-accent: #DCC"/>
        {/if}

        
    </div>
</div>