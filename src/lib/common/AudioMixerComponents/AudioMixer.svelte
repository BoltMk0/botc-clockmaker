<script lang="ts">
    import { browser } from "$app/environment";
    import { ClocktowerAudioEngine } from "$lib/client/audio/AudioEngine";
    import type { ClockClientModel } from "$lib/client/model";
    import { onDestroy, onMount } from "svelte";
    import ChannelStrip from "./ChannelStrip.svelte";
    import type { AudioTrackBase } from "$lib/client/audio/AudioTrackBase";

    export let audioEngine: ClocktowerAudioEngine;
    

    function handleAudioParamsChange(track: AudioTrackBase, params: {gain: number, pan: number}){
        track.pan = params.pan;
        track.gain = params.gain;
    }
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
            {#each audioEngine.allClockTracks() as {track, model} (model.clockId)}
                <div style="">
                    <ChannelStrip audioTrack={track} title={model.config.teamName ?? model.clockId} on:audioParamsChange={(e) => handleAudioParamsChange(track, e.detail)} onChannelStripTitleClick={()=>{model.ringFinalBell(true)}}/>
                </div>
            {/each}
        {/if}
    </div>
</div>