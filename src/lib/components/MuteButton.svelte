<script lang="ts">
    import type { AudioEngine } from "$lib/audio/client/AudioEngine";
    import MutedIcon from "./MutedIcon.svelte";
    import UnmutedIcon from "./UnmutedIcon.svelte";

    let {
        audioEngine
    }: {
        audioEngine: AudioEngine;
    } = $props();
</script>

<div class="mute-button-container" style="opacity: {audioEngine.muted ? 0.5 : 0.1}">
    <button id='mute-button' class="no-button-style" onclick={()=>{audioEngine.muted = !audioEngine.muted}}>
        {#if audioEngine.muted}
            <MutedIcon color='red' size={30}/>
        {:else}
            <UnmutedIcon color='white' size={30}/>
        {/if}
    </button>
</div>

<style>
    .mute-button-container {
        position: fixed;
        right: 1em;
        top: 1em;
    }

    .mute-button-container:hover {
        opacity: 1 !important;
    }

    #mute-button {
        cursor: pointer;
        padding: 10px;
    }
</style>