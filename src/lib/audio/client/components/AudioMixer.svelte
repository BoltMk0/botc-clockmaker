<script lang="ts">
    import { ClocktowerAudioEngine } from "$lib/audio/client/model/AudioEngine.svelte";
    import ChannelStrip from "./ChannelStrip/ChannelStrip.svelte";
    
    let {
        audioEngine
    }: {
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
            {#each audioEngine.allClockTrackModels() as {track, model} (model.clockId)}
                <div style="">
                    <ChannelStrip audioTrack={track} title={model.config.teamName ?? model.clockId} onTitleClick={()=>{model.ringFinalBell(true)}}/>
                </div>
            {/each}
        {/if}
    </div>
</div>